# Architecture

The backend is an internal Electron component. The main process controls one utility process, which owns NestJS,
listeners and SQLite. React uses HTTP for every business operation. IPC is limited to worker lifecycle and the
local maintenance window (Admin recovery, backup and restore).

## Architecture and layout

[AGENTS.md](../../../AGENTS.md) is authoritative for agent rules. All five SOLID principles and the dependency boundaries
are mandatory. The backend uses Screaming Architecture: business features remain at the root of `apps/server/src/`,
with framework/protocol details at the infrastructure periphery. The official terms are **driving** for inputs and
**driven** for outputs. All project-owned folders and production source basenames use kebab-case: words are separated
by dashes, never underscores, throughout the repository. Examples include `use-cases/`, `value-objects/`, and
`third-party/`. Required tool-defined names retain their spelling. Source files keep the existing role suffixes,
including `.usecase.ts` rather than the reference's `.service.ts` example.

The source and architectural checks use the driving/driven/config layout below. The
[migration record](architecture-migration-plan.md) describes the changes and verification. Existing `use-cases/`
folder names are retained. Authentication and session renewal use shared driving contracts; the other use cases
implement focused feature-owned driving interfaces.

```text
apps/server/src/
  identity/                         # Business features remain visible
  server-settings/
  <feature>/
    domain/
      entities/
      value-objects/
      exceptions/
      services/
    application/
      use-cases/
      services/                     # When needed for shared application behavior
      ports/
        driving/                    # One entry interface per use case
        driven/                     # Repositories and outbound capabilities
    infrastructure/
      adapters/
        driving/web/                # HTTP controllers, guards, schemas, filters
        driven/persistence/         # Kysely repositories, rows, migrations, mapping
        driven/third-party/         # External APIs when needed
      config/                       # Nest modules and string DI tokens
  shared/                           # Actual shared pure contracts and technical capabilities
  infrastructure/
    adapters/driving/web/           # Public health controller
    config/                         # Root module, bootstrap, local maintenance and development data
apps/web/src/                       # Browser features and HTTP client
apps/desktop/src/                   # Electron lifecycle, worker, maintenance window and preload
packages/contracts/src/             # HTTP shapes only
tools/architecture/                 # Resolver-based Oxlint plugin and CLI fixtures
```

Create only folders with a current responsibility. Filesystem, crypto, runtime and other driven adapters use focused
subdirectories as needed, not `third-party/` merely because they are technical. Shared technical code follows the same
adapter/config separation under `shared/infrastructure/`; shared pure code stays in shared domain/application.

Domain/application remain pure TypeScript. Entities own invariants; use cases implement driving interfaces and
orchestrate one action through driven ports. Domain never depends on application ports. Controllers validate Zod
schemas through Nest's Standard Schema support, extract authenticated context, and invoke driving contracts. HTTP
contracts, guards, schemas and failure translation belong in driving web adapters. There is no separate presentation
layer in the target. Driving adapters cannot import driven implementations.

Nest modules under `infrastructure/config/` own composition. Define string DI tokens in the owning module and register
driving/driven interface providers. Factory providers use `useFactory`/`inject` and parameters typed as pure ports.
Core classes and driven adapters stay plain and constructor-injected, without NestJS imports/decorators. NestJS is
allowed in driving adapters/config only. Controllers may use the registered string literal with `@Inject` and a driving
interface type to avoid circular imports from the module that registers them; HTTP tests verify provider resolution.

Each use case has one public business operation in its own `<name>.usecase.ts` file and matching
`<name>.usecase.spec.ts` test. Private helpers do not count as additional operations. A helper used only by one class is
private; shared application behavior belongs in focused feature-owned services with constructor-injected ports.
Identity shares account loading and password confirmation through `application/services/`, preserving pure core classes
and Nest-only composition.

Classes are preferred over standalone functions for production behavior, including reusable helpers and utilities.
Keep helpers used by one class as private methods. Inject dependencies through constructors; pure, stateless helper
and utility classes may use static methods. React functional components/hooks, API callbacks and Nest factory providers
retain their function forms. See [AGENTS.md](../../../AGENTS.md#class-preference) for the project convention.

HTTP and TLS settings are immutable domain value objects in `.value-object.ts` files. Their constructors enforce port
bounds and the certificate requirement for enabled TLS; snapshots carry plain values across HTTP and storage boundaries.
TLS reads retain saved values for inspection and correction of older configurations, while writes require a validated
value object. Reusable authorization, desktop configuration, private storage and browser HTTP behavior belong to focused
classes; filesystem behavior uses constructor-injected infrastructure adapters.

Production files use kebab-case basenames and role suffixes: `.interface.ts` for one interface per file in
`application/ports/` only, `.service.ts`, `.repository.ts`, `.adapter.ts`, `.helper.ts`, `.entity.ts`, `.util.ts`,
`.controller.ts`, and `.usecase.ts`. Interfaces outside application ports may remain with their related types. Unit tests
retain the full source basename, such as `user.entity.spec.ts`; controller tests use
`<name>.controller.e2e-spec.ts`.

| Source                   | Permitted first-party destinations                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Domain                   | Own/shared pure domain                                                                          |
| Application              | Own/shared pure domain/application; explicit feature application contracts                      |
| Driving adapters         | Inner contracts, shared driving support and HTTP contracts; no driven implementations or config |
| Driven adapters          | Inner contracts and focused shared driven implementations; no driving adapters or config        |
| Config modules/bootstrap | Dependencies needed for composition                                                             |
| Web                      | Web and HTTP contracts                                                                          |
| Contracts                | Contracts                                                                                       |
| Desktop                  | Desktop/contracts and the server's bootstrap/maintenance/development-data entry points         |

Cross-feature collaboration uses explicit narrow inner contracts; a feature cannot import another feature's
infrastructure. Root composition may wire features; shared adapters must not reach into feature implementations.

Books and collections collaborate this way. `books` declares two driven ports, both implemented by the collections
application service `BookCollectionMembership`: `CollectionMembership` for writers (book saves and deletions apply
the collection rules — name matching, volume 0, coverage overlap, planned-book replacement, reopening and removal of
empty collections — in the same transaction) and `BookCollectionReader` for the views and audit snapshots that only
read a book's membership. `collections` declares `CollectionBookSearch`, implemented by the books catalog,
so collection listings reuse the book search. The application root wires both (`CollectionsModule.membership`).

An operation that changes another feature's subject as a consequence records that change too: the membership port
returns the collection changes it caused (`collection.created`, `collection.updated` for volume 0,
`collection.reopened`, `collection.removed`), and the book use case passes them to `AuditedOperation` as related
changes. They are recorded with the book operation's ID and actor, so Activity can group them with the book change.

Books, locations and tags collaborate the same way. `books` declares a writer and a reader port for each:
`ShelfAssignment` / `BookLocationReader`, implemented by the locations service `BookShelfAssignment` (an unknown shelf
is refused; locations are never created from a book), and `TagAssignment` / `BookTagReader`, implemented by the tags
service `BookTagAssignment` (an equivalent name reuses its tag, a new name creates one and returns a `tag.created`
related change for the book operation's audit). Book saves and `PATCH /api/books/:id/organisation` use the writers
through `BookOrganiser`; views and audit snapshots use the readers through `BookOrganisationReader`. The root wires
one instance to both ports of a pair (`LocationsModule.assignment`, `TagsModule.assignment`).

The development data commands (development only) follow the same rule. `development-data` declares
`LibraryAdministrator`, implemented by the identity service `LibraryAdministratorLookup` (`IdentityModule.administrator`),
and `CoverFileCleanup`, which compares the books' cover references with the books `CoverStorage` (`list`, `remove`).
It saves books through the books `ImportBook` use case, registered only for these commands (`developmentImport`).

Two read-only features present the shared library without owning any table. `activity` (Task 8) turns the technical
audit log into the shared Activity: the pure domain services `ActivityEligibility` (an allowlist of the shared
categories), `ActivityProjection` (one operation becomes one entry, the main record chosen by category, the others
listed as its consequences) and `ActivityTimeline` (a cover change joins the save of the same book by the same account
made at most two minutes before) do the business work; the driven port `ActivityRecordReader` reads Successful records
grouped by operation ID, with the acting account's current username and a book's current title, and pages by
operation. Nothing in it writes the audit log, which stays with `AuditedOperation`. `overview` reads counters, the
most recently added Owned books, bookcases and the viewer's own reading through `LibrarySummaryReader`; the use case
`GetOverview` withholds every reading value from Guests.

Generated titles cross the books/collections boundary the other way. `books` owns titles and their provenance
(`BookDetails.titleGenerated`, the `GeneratedTitle` format `Name Vol. N` / `Name Vol. N–M`, the Manga/Comics eligibility and
`title-required`); a blank title asks for generation. After a book save applies its membership, `GeneratedTitleSync`
gives a generated title the resolved collection spelling and coverage, then reruns the no-ISBN duplicate check on it.
For collection-wide changes `collections` declares `MemberTitles`, implemented by the books service
`CollectionMemberTitles` (`BooksModule.memberTitles`, wired at the root): a rename regenerates generated titles and a
whole-collection deletion keeps them as supplied titles, each change recorded as a related `book.retitled` entry of
the collection operation.

Books and lending collaborate through two ports declared by `books`, both implemented in the lending application
layer and built at the root (`LendingModule.bookLoans`, `LendingModule.history`): `BookLoanReader` (`BookLoanLookup`)
gives book details and list items their active loan and feeds `LentBookGuard`, which refuses (`book-lent`) to delete a
lent book or save it as Not Owned; `LoanHistory` (`BookLoanHistory`) refreshes the title and ISBN copy kept on a
book's completed loans just before the book is deleted. `ListBooks` adds loans to the catalog page itself, so the
books catalog never reads lending tables. Lending reads the books it lends through its own `LendableBooks` port.

A lending or a return is one operation over several subjects. `AuditedOperation.runBatch` records one Successful entry
per subject, all sharing the operation ID (per book for `loan.lent`, per loan for `loan.returned`), plus related
changes such as `receiver.created`; if the batch fails, nothing persists and every requested subject gets a Failed
entry written after the rollback.

Advanced book filters are a shared application value, `BookFilter` (`shared/application/book-filter.ts`), because two
features apply it: the books catalog filters book listings and, through `CollectionBookSearch`, the collection
listing, where one book must satisfy the whole expression. Its query parameters and their mapping are shared driving
support (`book-filter-query.ts`, `book-filter-query.mapper.ts`) used by both controllers.

Shared code is for actual shared capabilities: actor authorization, failure types, clocks, IDs, authentication and
session-renewal contracts, database connection management and HTTP security. Feature behavior stays with its feature. Do
not add generic service containers or wrappers without a current purpose.

First-party imports are relative, including sibling workspaces. NodeNext sources use `.js` specifiers, emitted into a
common `dist` directory preserving the source workspace layout. Vite reads browser/contracts source and produces
`dist/apps/web`. Project aliases are forbidden. Deep `../` paths are valid if their resolved destination respects the
boundary.

Oxlint and its companion CLI fixtures resolve actual import destinations, including type imports, re-exports,
normalization, symlinks and TypeScript behind `.js` specifiers. They distinguish driving, driven and config boundaries,
including root/shared exceptions. NestJS is allowed in driving/config only; driving adapters cannot access persistence
or concrete use cases, and adapters cannot import config. Cross-feature infrastructure dependencies remain forbidden.
Checks also enforce relative imports, purity, port direction/naming, implemented driving interfaces, role suffixes,
folder word separators and test pairing. Lint alone cannot prove SOLID: review responsibilities and observable
contracts as well.

Read-only repository/settings consumers use reader ports; write-only consumers use writer ports. Adapters implement
aggregate repository/store contracts when they supply both capabilities. Token issuing and verification have separate
ports; authentication depends only on verification. These narrow contracts retain existing behavior and test doubles.

## Domain and persistence separation

Domain entities live in `domain/entities/`, value objects in `domain/value-objects/`, and pure business exceptions in
`domain/exceptions/`. Domain classes have no ORM or NestJS decorators. HTTP status mapping belongs in driving web
adapters, not business exceptions.

Persistence records/table shapes, schemas and migrations live under driven persistence. Kysely uses plain TypeScript
row/table shapes; no TypeORM/Prisma/Mongoose dependency or decorated persistence class is required. Repositories map
records into domain objects on reads and domain objects into records on writes. Extract a focused persistence mapper
only when needed. Application ports expose domain/application contracts, never row shapes. Rehydration must preserve
business invariants. This separates business entities from storage models without changing the current database stack.

## Storage, identity and transport

SQLite enables WAL, foreign keys and a busy timeout. Kysely runs versioned migrations before HTTP starts. An initial
administrator is created only when the users table is empty. Adapters contain row types; the core contains no Kysely,
SQLite, NestJS, Electron, React, Node or Zod imports. Owner-scoped private data (such as personal book notes) must include owner predicates in
every SQL read and write; a foreign ID returns 404, including for administrators.

JWTs live in HttpOnly SameSite cookies, with different names for HTTP and HTTPS. Only HTTPS cookies use Secure. The key
is persisted in the data directory. Signing keys and TLS material have owner-only POSIX permissions or protected Windows
ACLs allowing the current account, SYSTEM and administrators. Tokens expire after an idle hour; authenticated actions
renew them. Passive requests marked `X-App-Activity: passive` and public health calls do not renew them. The browser has
no refresh token or refresh timer. A persisted token version invalidates old sessions after password changes/recovery.
Repository writes compare the previously read version, and renewal checks the authenticated version, protecting against
concurrent stale credential requests.

Mutating API requests require JSON, a matching Origin and a signed double-submit CSRF token obtained from
`/api/auth/csrf`. The only exception to JSON is a cover upload (`PUT /api/books/:id/cover`), whose body is the image
itself (`image/*` or `application/octet-stream`, at most 10 MB); browsers cannot send these types from a cross-site
form, and the Origin and CSRF checks still apply. Cover images are stored under `covers/` in the data directory with
server-chosen random names and are checked by content (JPEG, PNG or WebP), never by the declared type. Cookies and private values are never placed in localStorage. The API is same-origin, without
permissive CORS. Proxy trust is disabled; a future TLS-terminating proxy needs an explicit trust/protocol design before
changing this setting.

HTTP starts before optional HTTPS. Both listeners use the same Express/Nest application, serving the frontend pages
and API to external browsers. The server-settings feature stores an HTTP port under the `http` key in SQLite alongside
the existing TLS configuration. HTTP defaults to `3000`; explicit CLI and environment overrides take precedence over the
saved preference. Both user-facing port settings require integers in `1024`–`65535` and reject enabled HTTP/HTTPS port
collisions. Saved HTTP and TLS settings become active on a full desktop restart. Configured and running state are
separate; startup snapshots track pending changes, and settings report active HTTP overrides. HTTPS errors, including
legacy ports below `1024`, preserve HTTP and allow correction from settings. No redirects or HSTS are included.

Internet access (Task 9.5) is an exception to the restart rule. `server-settings` owns it: the Admin's set up asks the
router for an external `443` → HTTPS port rule through a `RouterGateway` port (UPnP, then NAT-PMP), classifies the
router's external address (CGNAT, double NAT), and issues a Let's Encrypt IP address certificate (`shortlived`
profile) through a `CertificateAuthority` port. The HTTPS listener answers the TLS-ALPN-01 challenge itself: its
`SNICallback` serves the challenge certificate for the reverse-DNS name of the address (RFC 8738) when `acme-tls/1` is
negotiated. The listener starts and swaps certificates live (`setSecureContext`) through an `HttpsRuntime` port, without
a restart. An upkeep timer in root composition runs the maintain use case at startup and hourly: it recreates the
router rule (2-hour lease) on every run, follows a changed public address and renews certificates. Only the
certificate and domain name work waits longer after a failure; a run that cannot keep a router rule is tried again
after 1, 5 and 15 minutes (`UpkeepSchedule`), and each run's outcome is written to the log. The UPnP adapter searches
the router once per call, up to three times. Automatic certificates live in the same
protected `tls/` storage as manual ones, with their source recorded.

Task 9.6 adds a saved domain name and HTTP from the internet. The domain name is its own setting, checked on save
through a `DomainNameResolver` port against the public address. The HTTPS internet access copies it as the name its
certificate covers (`dns` identifier, `classic` profile, challenge certificate served for the name itself, renewal at
two thirds of the lifetime, a changed public address needs no new certificate). HTTP from the internet is a separate
`HttpInternetAccess` entity: a router rule from the HTTP port to the HTTP port, kept by the same upkeep timer, closed
when an HTTPS setup succeeds.

No test reaches a real router, Let's Encrypt, the public address service or DNS. Unit and API tests use in-memory
doubles; browser journeys pass stand-ins; every Electron test launch (browser, desktop, packaged smoke) sets
`APP_OFFLINE_INTERNET_ACCESS=1`, and the desktop worker then builds `OfflineInternetAccess` instead of the real
adapters. Only a normal launch (including `npm run dev`) uses the real ones.

## Runtime and packaging

Normal startup waits for utility-process readiness before loading the web app. Ports, database failures and worker
failures produce retry/quit choices. Closing the window quits on all platforms. Shutdown stops listeners, Nest and
SQLite before terminating the worker; a timeout handles an unresponsive process. A per-data-directory Electron profile
provides the single-instance lock, shared by normal and maintenance startup.

The worker resolves the saved HTTP port after SQLite initialization and reports the actual listening port to Electron.
Electron loads that URL, while development tooling updates Vite's API proxy from the backend readiness message before
loading the renderer. An unavailable HTTP port fails startup with the requested port and error code; an explicit
temporary `--http-port` override allows the administrator to reopen settings and correct the preference. Backend retries
read saved settings again. Internal test fixtures can bind ephemeral port `0`; desktop CLI/environment validation
retains the production minimum.

Local maintenance (Task 9) runs with no network listener: the menu **Maintenance → Open local maintenance…** stops the
backend and replaces the Libris window with the maintenance window, and closing it starts the application again;
`--maintenance` opens the same window without starting the application. Only that local sandboxed page gets a
CommonJS preload (`window.maintenance`: status, recover, create, choose and restore a backup), each call validated
against the sending window and frame. File paths come only from native dialogs in the main process. Its own utility
process runs `LocalMaintenance` (root config), which migrates an existing database like a normal start, never creates
one except by a restore, and opens and closes the database for each step so the file can be copied or replaced.
Normal renderers have no business IPC bridge. Context isolation, sandboxing and disabled Node integration are explicit.

A backup is a `.mcbackup` ZIP (`fflate`): `manifest.json` (format, application, version, creation time, counts and a
SHA-256 per entry), `application.sqlite`, `covers/` and `tls/`. `session.key` and the Electron profile stay out. A
restore checks the manifest, the version (exactly the running one) and the checksums, stages the files in the data
directory, checks that the staged database has exactly the current migrations, a protected Admin and every cover it
names, then moves the current files aside and the staged ones in, putting the current ones back on any error. A new
`session.key` then ends every session. The Admin data reset (`POST /api/maintenance/data-reset`) deletes the library,
the audit log, the other accounts and the saved preferences in one transaction (loans before receivers), keeps the HTTP
and HTTPS settings, and records `maintenance.data-reset` as the only audit record left.

Electron starts ready-dependent work from `app.whenReady().then(...)`, keeping its ESM entry evaluation free to
complete. The sandboxed maintenance preload uses CommonJS because sandboxed preloads cannot use ESM imports.
See [Electron's ESM guidance](https://www.electronjs.org/docs/latest/tutorial/esm)
and [utility-process API](https://www.electronjs.org/docs/latest/api/utility-process).

electron-builder packages the common `dist` tree, maintenance window assets and runtime dependencies. Native `.node` binaries are
unpacked from ASAR; better-sqlite3 13 uses Node-API. TypeScript compilation uses its CLI, not a programmatic compiler
API. Installed packages run without system Node. Verify native loading and relative imports by running the package
outside the checkout, as the smoke script does.

## Removed Notes demo

The foundation's Notes example feature was removed for Media Collection. Migration history was retained: migration
`002-media-collection-foundation` drops the Notes table/index (and adds the personal interface language) rather than
editing the applied initial migration, so existing databases upgrade cleanly. The identity and server-settings features
remain the reference pattern for browser → controller → focused use case/entity → repository port → Kysely → SQLite.

## Review and tests

Read [AGENTS.md](../../../AGENTS.md) and use [architecture-review](../../../.agents/skills/architecture-review/SKILL.md) before
finishing changes. Core tests use direct constructors and manual port doubles. Every HTTP endpoint has HTTP
`.e2e-spec.ts` coverage; storage and runtime tests use actual SQLite and Electron. Treat demonstrated SOLID and
dependency violations as mandatory findings. Label only improvements beyond compliance as optional. Simple compliant designs need no speculative strategies or interfaces.

Each controller's HTTP tests live beside it as `<name>.controller.e2e-spec.ts`. They use the shared
`tests/api/setup/TestApp` implementation (in `test-app.ts`), Nest TestingModule, production HTTP
middleware/guards/validation, and isolated real SQLite. Entity fixtures in `tests/api/fixtures` prepare persisted users
through typed ports, loaded in dependency order. Independent clients prepare real cookie sessions and
CSRF. Fixture setup/teardown belongs in hooks; cases arrange their scenario, perform one endpoint request, and assert
its outcome with visible blank-line separation and no block-label comments or routine try/catch.

Arranging test data uses entity builders (Task 5.8). Each feature owns its builders next to its doubles in
`application/testing/` (`BookBuilder`, `ReceiverBuilder`, `LoanBuilder`, base `EntityBuilder` and `TestIds` in
`shared/application/testing/`): `with…` sets one value, `as…` sets a coherent state (`asPlanned()`, `asGenerated()`,
`asReturned()`), `build()` returns the entity and `buildAndSave(ports)` stores it through the repository ports
(memory doubles in unit tests, SQLite adapters in API tests), creating missing parents. `TestLibrary`
(`tests/api/fixtures/test-library.ts`) composes builders across features (a loan without a book gets one) and accepts
plain `BookFacts` for specs outside the books feature, which feature boundaries keep from the books builder; the API
test context exposes it as `builders`. Builders only arrange preconditions: a test about a rule uses its use case or
endpoint. Browser tests keep arranging data over HTTP. Other features adopt builders when their tests are next touched.

Runtime scenarios in `tests/api/foundation.e2e-spec.ts` and desktop cases retain Electron startup/restart/recovery
coverage. They complement controller tests. Unit tests for executable entities, value objects, use cases, and utilities
use exact matching sibling `.spec.ts` files. Pure core tests use manual port doubles, never Nest testing modules.
Architecture checks enforce role naming, port-interface ownership, file pairing, and one public operation per use case;
review verifies actual behavior coverage and responsibility.

`apps/server/tsconfig.json` gives editors a discoverable backend project inheriting legacy decorator settings from
`tsconfig.runtime.json`. Build scripts retain the runtime config, excluding tests and `.test-support.ts` files from
production output.

## Persistence identities and SQL

Application tables with a single-column primary key use UUID IDs with SQLite `TEXT NOT NULL PRIMARY KEY`
and UUID-format CHECK constraints. Composite keys and Kysely migration tables are exempt. Settings retain unique
names for lookup alongside UUID identities; audit row IDs and operation IDs are independent UUIDs.
Native UUID generation stays in infrastructure behind the ID generator port. Audit subject keys remain descriptive.

Historical migrations live under shared driven persistence in `migrations/`, loaded by `DatabaseMigrations`.
Their original names and order remain stable. Migration 006 rebuilds related tables transactionally, preserving
valid entity IDs, relationships, settings and audit payloads. Invalid legacy entity IDs stop the upgrade before schema
changes and require explicit data repair. Audit integer keys and settings names receive UUID identities.

Each table is written only by the adapters of the feature that owns it. Read adapters may join another feature's
tables for listings and views (the books catalog reads collection names and volumes and filters on `book_shelves`
and `book_tags`; the collection member store reads book titles and ownership; location and tag overviews count
books), never write them. Collection membership has its own `collection_books` table keyed
by book and collection, with a unique book index for the current one-collection rule (migration 007). Migration 008
adds `bookcases`, `shelves` (names unique per bookcase), `book_shelves` (keyed by book and shelf, with a unique book
index: at most one shelf per book), `tags` and `book_tags`; deleting a bookcase, shelf, tag or book cascades to its
links, never to books. Migration 009 adds `receivers` (unique comparison key) and `loans`, one row per loan
occurrence. A partial unique index on `loans(book_id) WHERE status = 'lent'` keeps one active loan per book even
for simultaneous confirmations; CHECK constraints tie the return date to the status and keep an active loan's book.
Deleting a book sets `book_id` to null on its completed loans, which stay identifiable by their title and ISBN copy;
a lent book cannot be deleted.
Migration 010 adds `books.title_generated` (0/1, existing titles 0) and `books.title_sort_key`, the title key with
digit runs zero-padded so title order compares numbers by value; the books repository writes both on every save.

Runtime adapters use Kysely builders, including `instr` for literal searches on normalized keys. Raw SQL is allowed
in migrations and database-boundary tests only. Connection setup retains a narrow exception for driver construction
and foreign-key/WAL/timeout configuration. Architecture lint enforces the boundary; persistence tests inspect all
application primary keys and exercise their UUID constraints.
