# Architecture

The backend is an internal Electron component. The main process controls one utility process, which owns NestJS,
listeners and SQLite. React uses HTTP for every business operation. IPC is limited to worker lifecycle and the
separately launched, local administrator recovery dialog.

## Architecture and layout

[AGENTS.md](../AGENTS.md) is authoritative for agent rules. All five SOLID principles and the dependency boundaries
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
    config/                         # Root module, bootstrap and recovery
apps/web/src/                       # Browser features and HTTP client
apps/desktop/src/                   # Electron lifecycle, worker, recovery preload
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
retain their function forms. See [AGENTS.md](../AGENTS.md#class-preference) for the project convention.

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
| Desktop                  | Desktop/contracts and the server's bootstrap/recovery entry points                              |

Cross-feature collaboration uses explicit narrow inner contracts; a feature cannot import another feature's
infrastructure. Root composition may wire features; shared adapters must not reach into feature implementations.

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
`/api/auth/csrf`. Cookies and private values are never placed in localStorage. The API is same-origin, without
permissive CORS. Proxy trust is disabled; a future TLS-terminating proxy needs an explicit trust/protocol design before
changing this setting.

HTTP starts before optional HTTPS. Both listeners use the same Express/Nest application, serving the frontend pages
and API to external browsers. The server-settings feature stores an HTTP port under the `http` key in SQLite alongside
the existing TLS configuration. HTTP defaults to `3000`; explicit CLI and environment overrides take precedence over the
saved preference. Both user-facing port settings require integers in `1024`–`65535` and reject enabled HTTP/HTTPS port
collisions. Saved HTTP and TLS settings become active on a full desktop restart. Configured and running state are
separate; startup snapshots track pending changes, and settings report active HTTP overrides. HTTPS errors, including
legacy ports below `1024`, preserve HTTP and allow correction from settings. No certificate issuance, redirects or HSTS
are included.

## Runtime and packaging

Normal startup waits for utility-process readiness before loading the web app. Ports, database failures and worker
failures produce retry/quit choices. Closing the window quits on all platforms. Shutdown stops listeners, Nest and
SQLite before terminating the worker; a timeout handles an unresponsive process. A per-data-directory Electron profile
provides the single-instance lock, shared by normal and recovery startup.

The worker resolves the saved HTTP port after SQLite initialization and reports the actual listening port to Electron.
Electron loads that URL, while development tooling updates Vite's API proxy from the backend readiness message before
loading the renderer. An unavailable HTTP port fails startup with the requested port and error code; an explicit
temporary `--http-port` override allows the administrator to reopen settings and correct the preference. Backend retries
read saved settings again. Internal test fixtures can bind ephemeral port `0`; desktop CLI/environment validation
retains the production minimum.

Recovery starts no network listeners. Only its local sandboxed window gets a CommonJS preload exposing one
password-reset call, validated against the sending window/frame. The recovery utility process opens existing storage
only, without migration/seeding. Normal renderers have no business IPC bridge. Context isolation, sandboxing and
disabled Node integration are explicit.

Electron starts ready-dependent work from `app.whenReady().then(...)`, keeping its ESM entry evaluation free to
complete. Sandboxed recovery preload uses CommonJS because sandboxed preloads cannot use ESM imports.
See [Electron's ESM guidance](https://www.electronjs.org/docs/latest/tutorial/esm)
and [utility-process API](https://www.electronjs.org/docs/latest/api/utility-process).

electron-builder packages the common `dist` tree, recovery assets and runtime dependencies. Native `.node` binaries are
unpacked from ASAR; better-sqlite3 13 uses Node-API. TypeScript compilation uses its CLI, not a programmatic compiler
API. Installed packages run without system Node. Verify native loading and relative imports by running the package
outside the checkout, as the smoke script does.

## Removed Notes demo

The foundation's Notes example feature was removed for Media Collection. Migration history was retained: migration
`002-media-collection-foundation` drops the Notes table/index (and adds the personal interface language) rather than
editing the applied initial migration, so existing databases upgrade cleanly. The identity and server-settings features
remain the reference pattern for browser → controller → focused use case/entity → repository port → Kysely → SQLite.

## Review and tests

Read [AGENTS.md](../AGENTS.md) and use [architecture-review](../.agents/skills/architecture-review/SKILL.md) before
finishing changes. Core tests use direct constructors and manual port doubles. Every HTTP endpoint has HTTP
`.e2e-spec.ts` coverage; storage and runtime tests use actual SQLite and Electron. Treat demonstrated SOLID and
dependency violations as mandatory findings. Label only improvements beyond compliance as optional. Simple compliant designs need no speculative strategies or interfaces.

Each controller's HTTP tests live beside it as `<name>.controller.e2e-spec.ts`. They use the shared
`tests/api/setup/TestApp` implementation (in `test-app.ts`), Nest TestingModule, production HTTP
middleware/guards/validation, and isolated real SQLite. Entity fixtures in `tests/api/fixtures` prepare persisted users
through typed ports, loaded in dependency order. Independent clients prepare real cookie sessions and
CSRF. Fixture setup/teardown belongs in hooks; cases arrange their scenario, perform one endpoint request, and assert
its outcome with visible blank-line separation and no block-label comments or routine try/catch.

Runtime scenarios in `tests/api/foundation.e2e-spec.ts` and desktop cases retain Electron startup/restart/recovery
coverage. They complement controller tests. Unit tests for executable entities, value objects, use cases, and utilities
use exact matching sibling `.spec.ts` files. Pure core tests use manual port doubles, never Nest testing modules.
Architecture checks enforce role naming, port-interface ownership, file pairing, and one public operation per use case;
review verifies actual behavior coverage and responsibility.

`apps/server/tsconfig.json` gives editors a discoverable backend project inheriting legacy decorator settings from
`tsconfig.runtime.json`. Build scripts retain the runtime config, excluding tests and `.test-support.ts` files from
production output.
