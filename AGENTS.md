# Agent Engineering Guidelines

## 🧩 SOLID Principles (Mandatory)

**All five SOLID principles are mandatory for new and modified production code.** Review existing code against them
when it is in scope. Demonstrated SOLID violations are mandatory findings, not optional design advice. Apply the
principles to actual responsibilities and contracts; compliance does not require speculative abstractions, inheritance,
or an interface for every class.

Code generation and review must enforce these requirements:

- **S - Single Responsibility Principle (SRP):**
    - _Rule:_ A class or function should have one, and only one, reason to change.
    - _Application:_ Keep Use Cases focused on a single business action (for example, `CreateUserUseCase`, not
      `UserOperationsService`). Keep Controllers focused on HTTP concerns: routing, transport validation,
      authentication/authorization context extraction, calling the application layer, and response/error mapping.
- **O - Open/Closed Principle (OCP):**
    - _Rule:_ Software entities should be open for extension, but closed for modification.
    - _Application:_ Use polymorphism, configuration objects, or strategy patterns when a feature genuinely requires
      multiple behavioral variations rather than accumulating long `switch` or `if/else` branches. Do not introduce
      abstractions for hypothetical future needs.
- **L - Liskov Substitution Principle (LSP):**
    - _Rule:_ Implementations of an abstraction must be substitutable without breaking the application contract.
    - _Application:_ Infrastructure implementations such as `KyselyUserRepository` and test doubles such as
      `InMemoryUserRepository` must follow the exact behavioral, return-value, ownership, and error contract defined by
      the Application Port.
- **I - Interface Segregation Principle (ISP):**
    - _Rule:_ No client should be forced to depend on methods it does not use.
    - _Application:_ Keep Application Ports lean. Split large interfaces when consumers genuinely need different
      capabilities, for example `UserReader` and `UserWriter`, instead of introducing monolithic service interfaces.
- **D - Dependency Inversion Principle (DIP):**
    - _Rule:_ High-level modules must not depend on low-level implementation details. Both depend on abstractions.
    - _Application:_ Use Cases depend on Application
      Ports. Infrastructure adapters implement those ports. NestJS modules are responsible for composition and wiring.

---

## 🏛️ Architecture Is a Hard Constraint

The backend follows **Screaming Architecture with a pure Hexagonal Architecture**. Business features are visible at
the root of `apps/server/src/`; frameworks, protocols, persistence, and runtime details live at the infrastructure
periphery. Use **driving** for inputs/triggers and **driven** for outputs/dependencies in paths and documentation.

This is the single source of truth for agent rules, including Claude via `.claude/CLAUDE.md`. Source and automated
checks follow the structure below. The [migration record](docs/Media%20Collection/architecture/architecture-migration-plan.md) documents the change;
existing violations are not permission to introduce new ones.

Before adding or modifying backend code:

1. Identify the feature that owns the behavior.
2. Identify the intended layer before creating the file.
3. Verify that every dependency points in an allowed direction.
4. Prefer the smallest change that preserves the existing architecture and ownership boundaries.

Each backend feature uses these areas when needed; do not create empty scaffolding. All project-owned folder names
and production source basenames use kebab-case: separate words with dashes, never underscores. This applies throughout
the repository, including `value-objects/`, `use-cases/`, and `third-party/`. Tool-defined names such as `.claude/`
and `node_modules/` retain their required spelling.

```text
apps/server/src/<feature>/
  domain/
    entities/
    value-objects/
    exceptions/
    services/
  application/
    use-cases/
    services/                     # Focused application services when needed
    ports/
      driving/                    # Use-case entry contracts
      driven/                     # Repositories, clocks, hashers, gateways
  infrastructure/
    adapters/
      driving/
        web/                      # Controllers, guards, Zod schemas, HTTP mapping
      driven/
        persistence/              # Kysely repositories, row/schema types, mapping
        third-party/              # External API adapters
        ...                       # Focused runtime/filesystem/security adapters as needed
    config/
      <feature>.module.ts         # Nest composition and string DI tokens
```

The dependency direction is inward. Driving and driven adapters remain separate boundaries despite their common
infrastructure parent: moving controllers here does not permit access to persistence implementations.

| Area                              | Responsibility                                           | May depend on                                                             |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `domain`                          | Business entities, value objects, exceptions, invariants | Own/shared pure domain contracts                                          |
| `application`                     | Use cases, services, driving/driven ports                | Domain and explicit pure application contracts                            |
| `infrastructure/adapters/driving` | HTTP and authorized entry adapters                       | Inner contracts, HTTP contracts, transport libraries                      |
| `infrastructure/adapters/driven`  | Storage, runtime, external implementations               | Inner contracts, focused shared driven adapters, implementation libraries |
| `infrastructure/config`           | Modules, tokens, bootstrap and composition               | Inner layers and adapters required for composition                        |

Root bootstrap/recovery belongs in `apps/server/src/infrastructure/config/`; the public health controller belongs in
`apps/server/src/infrastructure/adapters/driving/web/`. Shared technical components use the same adapter/config
separation under `shared/infrastructure/`. Root/shared areas are narrow exceptions for actual composition or shared
capabilities, not alternative homes for feature behavior. Electron retains lifecycle ownership.

### Mandatory dependency rules

- `domain/` and `application/` must remain **pure TypeScript**.
- `domain/` and `application/` must not import NestJS, Kysely, SQLite libraries, Node-specific runtime APIs, Electron,
  React, Zod/transport validation libraries, or other infrastructure/framework dependencies, including through
  `import type`.
- NestJS imports/decorators and dependency-injection concerns belong only in driving adapters and
  `infrastructure/config/`. Driven adapters remain plain classes without NestJS imports or decorators.
- Controllers and guards must not instantiate or directly access Kysely repositories, SQLite adapters, or other
  infrastructure implementations.
- NestJS modules are the composition root and perform the wiring between ports, adapters, and use cases.
- Browser code must not import backend, Electron, or database implementation code.
- A feature must not depend directly on another feature's infrastructure. Cross-feature collaboration must go through an
  explicit, narrow contract owned at an appropriate inner/shared boundary.
- Do not move business rules into controllers, database queries, React components, NestJS guards, or Electron lifecycle
  code merely because it is convenient.

### Ports and dependency injection

- Every use case implements a focused entry interface in `application/ports/driving/`. Driving adapters consume that
  contract rather than the concrete use case. Each entry interface exposes one public business operation. Pure
  input/output types may live with the contract; HTTP DTOs, Zod schemas, and storage types must not.
- Outbound ports required by use cases belong in `application/ports/driven/` (for example repositories, hashers, clocks,
  signing-key stores, filesystem abstractions, or external gateways).
- Every interface declared in `application/ports/` has its own file, named `<interface-name>.interface.ts` in kebab
  case (for example, `UserRepository` in `user-repository.interface.ts`). A port file declares exactly one interface;
  import each contract directly from its owning file. This rule is scoped to application ports. Other interfaces, such
  as Kysely table shapes, domain state, HTTP contracts, and test support, may stay with their related types.
- Define ports around capabilities required by the application layer, not around the API of a specific database or
  framework library.
- The `domain/` layer must not depend on application ports. Domain entities, value objects, and domain services remain
  independent of application orchestration and persistence abstractions.
- Keep NestJS injection tokens and other composition-only details out of `domain/` and `application/`. Define them in
  the owning NestJS module in `infrastructure/config/` as string tokens. Register interface-backed dependencies using
  those tokens, including driving contracts. Factory parameters use port types, not concrete adapter types.
  Avoid module/controller import cycles: controllers may use the registered string literal in `@Inject` with a pure
  driving-interface type; API tests verify that injection and registration agree.
- Entities, use cases, and driven adapters are plain constructor-injected classes. Do not add `@Injectable()`
  simply to make NestJS wiring easier.
- NestJS modules must construct plain classes with factory providers (`useFactory` / `inject`) where dependency
  injection is required.
- Infrastructure adapters implement application ports; test doubles must implement the same observable contract as
  production adapters.

### HTTP boundary

- HTTP concerns belong in `infrastructure/adapters/driving/web/`. There is no separate `presentation/` layer.
- Validate request input at the transport boundary using **Zod with NestJS Standard Schema support**.
- Do not use `class-validator` DTO classes unless the architecture is explicitly changed.
- Convert transport input into application/domain input before invoking use cases.
- Convert domain/application failures into HTTP responses in the driving web adapter.
- Keep HTTP schemas, request/response contracts, database row shapes, and Kysely-specific types outside `domain/` and
  `application/`.
- Authorization decisions and ownership enforcement belong to the backend. Never trust the browser to provide an
  authoritative owner/user identifier for protected resources.

---

## Domain Entities and Persistence Models

- Domain entities in `domain/entities/` are pure business classes. Never add ORM decorators such as `@Entity`,
  `@Column`, or `@PrimaryColumn`, NestJS decorators, or storage-library types to them.
- Persistence models, row/table shapes, schemas, and migrations belong in driven persistence adapters. The current
  Kysely/SQLite stack uses plain table/row types; this rule does not introduce an ORM or decorated model classes.
- The repository adapter owns both mapping directions: persisted records to domain objects on reads, and domain
  objects to persisted records on writes. A dedicated mapper, when needed, stays in that persistence boundary.
  Do not expose storage shapes through ports or bypass domain invariants during rehydration.
- Pure business exceptions belong in `domain/exceptions/`. HTTP statuses and exception translation stay in driving
  adapters. Shared pure failures remain shared only when they represent an actual shared contract.


## UUID primary keys and SQL boundaries

- Every application-owned table with a single-column primary key must use a UUID `id` stored as
  `TEXT NOT NULL PRIMARY KEY` with a CHECK constraint validating UUID format. New IDs use the infrastructure
  `UuidGenerator` (`node:crypto.randomUUID()`), supplied through the `IdGenerator` port.
- Composite primary keys and Kysely-owned migration tables are exempt. Audit subject identifiers may remain
  descriptive strings or null. Settings names remain unique lookup keys alongside their UUID identities.
- Validate UUIDs at HTTP boundaries and enforce format at persistence boundaries. A TypeScript `string` or SQLite
  `TEXT` declaration alone is insufficient. Upgrades preserve valid IDs and relationships and reject invalid
  legacy IDs explicitly instead of silently remapping them.
- Production queries and schema access use Kysely builders. Handwritten SQL, including the `sql` tag, raw
  builders, compiled query construction and direct driver execution, is forbidden outside migrations.
- Historical schema/data migrations live in `apps/server/src/shared/infrastructure/adapters/driven/persistence/migrations/`.
  Only the migration provider loads them. They are exempt from the raw-SQL rule and runtime adapter filename
  suffixes, not dependency boundaries. Runtime adapters must not reuse migrations as query helpers.
- Direct SQLite access is restricted to connection construction and foreign-key, WAL and timeout PRAGMAs in
  `database.adapter.ts`. Connection settings must not move into one-time migrations.
- Database-boundary tests may use raw SQL and isolated drivers to inspect schema or build historical/corrupted
  fixtures. Test support must never become a production raw-SQL escape hatch.

---

## 📦 Imports and Workspace Boundaries

First-party source imports must use **relative paths**, including imports across sibling workspaces when the
architecture permits the dependency.

- Do not introduce project import aliases such as `@server/*`, `@domain/*`, or similar shortcuts.
- `../` segments are allowed and expected when required by a valid dependency.
- Third-party packages keep their normal package imports.
- For NodeNext ESM compiled sources, preserve the repository convention of `.js` extensions in relative imports where
  required for emitted JavaScript to resolve correctly.
- Do not attempt to bypass architectural checks through barrels, re-exports, type-only imports, dynamic imports, path
  normalization tricks, or alternate relative paths.
- When changing imports, reason about the **resolved destination**, not only the textual import path.

Architecture lint rules are expected to be enforced by Oxlint and the repository's companion architecture checks. Do not
weaken or disable an architecture rule to make a feature compile unless the architecture itself has explicitly been
changed.

---

## 🗂️ Feature Ownership and Scope

Prefer changes contained within the feature that owns the business behavior.

- Keep features independently understandable and, where intended, independently removable.
- Do not create generic `utils`, `services`, or `common` dumping grounds for feature-specific behavior.
- Move something to `shared` only when it is genuinely shared, stable, narrowly scoped, and does not introduce coupling
  between unrelated features.
- Reuse an explicit contract rather than reaching into another feature's internal classes or database adapter.
- Keep persistence details behind repository/gateway ports.
- A use case represents one application action and exposes one public business operation. This rule is scoped to
  use-case classes; method count alone does not determine whether a service, repository, or entity violates SRP.
  Private helper methods do not count as separate operations.
- One source file owns one responsibility. Each use-case class has its own file. A helper used only inside one class is
  a private method; shared behavior belongs to a focused feature-owned utility or constructor-injected application
  service. Do not add speculative abstractions or place feature-specific helpers in shared code.
- Entities should own business invariants that remain true independently of HTTP, storage, or UI concerns.

## Class Preference

### Backend: object-oriented code is mandatory

Backend code (`apps/server/src/`) is written in classes, as in C#. A standalone function, whether a `function`
declaration or a module-level arrow function, is not allowed when a class can hold the behavior.

- Behavior belongs to the class that owns it. A helper used by only one class is a private method of that class.
- Shared behavior is a focused class: an instance class with constructor-injected dependencies, or, when it needs
  neither state nor dependencies, a class of static methods (for example `NameKey.of(...)`, `ActorAuthorization`).
  Utility and helper files expose that class, with the `.util.ts` and `.helper.ts` suffixes.
- Module-level constants and type declarations are not functions and stay allowed.
- The only exceptions, kept as small as possible and delegating any real behavior to a class:
  - callbacks passed inline to a library or framework (for example `useFactory` providers in NestJS modules, array
    callbacks, Kysely expression builders, Zod refinements);
  - NestJS decorator factories (for example `Access(...)`), because decorators are functions by nature.
- This applies to production code and to shared test support (`*.test-support.ts`, `tests/api`), for example
  `BookInputFixture.of(...)`, `TestActors.of(...)`, builders, `TestLibrary`. A spec file may keep small arrange helpers
  as local functions.
- Enforced by the `architecture/backend-classes` lint rule (`apps/server/src` and `tests/api`, spec files excluded).

### Web

- Prefer classes over standalone functions for reusable behavior, including helpers and utilities, with the same
  `.helper.ts` / `.util.ts` suffixes and static methods for stateless utilities.
- A helper used only by one class remains a private method on that class. Keep reusable classes with their owning
  feature and layer.
- Keep function forms for React functional components and hooks and for callbacks. Reusable business, helper, and
  utility behavior should still belong to classes when called through those functions.

## Code Comments

- No code comments in production code, tests, tool scripts or stylesheets. Names, types and tests carry the meaning;
  do not comment a class, method, property, constant or block to explain the code's own behavior.
- Only these comments are allowed:
  - a fact about an external service or system the code depends on: a third-party API or record format (BnF, Open
    Library, Let's Encrypt/ACME, UPnP routers), a standard (an RFC, UNIMARC, EAN-13), or a behavior of Electron,
    the operating system, the browser or a library that the code works around;
  - a `// Justified: …` note on a `catch` that deliberately swallows an error;
  - tool directives (`@ts-expect-error`, lint suppressions, `/// <reference>`).

## Production File Naming

Use kebab-case basenames and the suffix for the file's actual production role:

| Role                                   | Suffix           |
| -------------------------------------- | ---------------- |
| Port interface in `application/ports/` | `.interface.ts`  |
| Application service                    | `.service.ts`    |
| Repository implementation              | `.repository.ts` |
| Infrastructure or runtime adapter      | `.adapter.ts`    |
| Focused reusable helper                | `.helper.ts`     |
| Domain entity                          | `.entity.ts`     |
| Standalone reusable utility module     | `.util.ts`       |
| Controller                             | `.controller.ts` |
| Use case                               | `.usecase.ts`    |
| Mapper                                 | `.mapper.ts`     |

The port interface suffix identifies the contract; repository implementations use `.repository.ts`. Do not repeat a
role in the basename and suffix (for example, use `kysely-user.repository.ts`). A helper used only by one class remains
a private method. Utilities and helpers stay with their owning feature and layer; do not create generic dumping grounds.
This table does not rename modules, guards, value objects, error types, React components/hooks, test-support files, or
runtime entry points whose roles are not listed.

Keep test siblings paired with their complete source basename: `login.usecase.ts` uses `login.usecase.spec.ts`, and
`identity.controller.ts` uses `identity.controller.e2e-spec.ts`. Preserve the NodeNext `.js` suffix in relative import
specifiers for emitted JavaScript.

Prefer simple, focused classes. Add interfaces, factories, strategies, or base classes only when they provide a current
architectural or testing benefit.

---

## 🖥️ Electron, Backend, and Runtime Ownership

The production NestJS backend is an **internal component of the Electron application**.

- Electron owns backend startup, readiness, execution, and graceful shutdown.
- Keep production backend lifecycle under Electron's lifecycle; do not introduce a competing standalone production
  startup path unless explicitly requested.
- Business operations use HTTP. Do not introduce Electron IPC as a parallel business API.
- IPC must remain narrowly scoped to lifecycle/recovery concerns that explicitly require it.
- React communicates with business functionality through HTTP and must not access SQLite, Kysely, backend internals, or
  Electron Node APIs directly.
- Runtime-specific concerns such as Electron lifecycle, filesystem locations, native module loading, and process
  management must not leak into domain or application code.

---

## 🧪 Testing Rules

Use **Vitest** for the project's automated tests. Tests are part of the architecture contract and must verify behavior
at the correct boundary.

### API / end-to-end tests

- **Every HTTP endpoint must be covered by API tests.**
- API test files must use the suffix **`.e2e-spec.ts`**.
- Every `<name>.controller.ts` has a **same-directory** `<name>.controller.e2e-spec.ts`, with dedicated suites for each
  endpoint. Runtime/desktop integration tests do not replace these files.
- Controller API tests use the shared `tests/api/setup/test-app.ts` TestingModule-backed fixture
  (`Test.createTestingModule`, `createNestApplication`) and real HTTP with production security/validation and isolated
  SQLite. Reuse entity fixtures in `tests/api/fixtures` for persisted prerequisites; keep fixture loading in Arrange.
  Extend focused fixtures instead of duplicating bootstrap/repository setup. Case-specific payload literals remain
  local.
- Fixture dependencies are typed application ports. Preserve real hashing, cookie sessions, CSRF, ownership, and
  foreign-key ordering. Cleanup belongs in hooks/fixture teardown and must work after partial setup. Electron
  lifecycle/desktop tests retain real Electron; this TestingModule rule applies to controller API tests.
- Exercise the endpoint through HTTP rather than calling the controller or use case directly.
- Cover the endpoint's meaningful success and failure behavior, including authentication/authorization and relevant
  validation cases.
- For protected resources, verify ownership boundaries where applicable; an authenticated user must not gain access to
  another user's private data.
- API/lifecycle integration tests that depend on the production runtime should exercise the Electron-managed backend
  when that behavior is relevant.

### Unit tests

The following code must be covered with focused unit tests using the suffix **`.spec.ts`**:

- domain entities and value objects;
- application use cases;
- pure utilities and reusable pure helpers.

For each executable source in scope, replace its `.ts` suffix with `.spec.ts`, preserving the basename, and place the
test in the **same directory** (for example `change-password.ts` and `change-password.spec.ts`). Interfaces/types,
behavior-free barrels, and test support do not need empty test files. Integration suites retain their appropriate
boundary and are not substitutes for focused unit coverage.

### Readable, focused test cases

- Write separate, explicitly named `it`/`test` cases instead of `it.each`/`test.each`, unless the user explicitly
  requests parameterized tests. Reuse focused setup helpers when useful; do not replace `.each` with loops that register
  tests.
- Every `it`/`test` has Arrange, Act, Assert blocks separated by blank lines, without comments naming the blocks.
- One case tests one behavior with one operation under test. Setup may prepare prerequisites, but must not hide other
  tested actions. For controller API cases, Act is exactly one endpoint request. Capture the result before assertions;
  do not embed another tested operation inside `expect`.
- Assert as many outcome properties as needed, including read-only state observations. Separate success/failure
  scenarios. Lifecycle cases may collect a read-only probe of the one lifecycle operation's outcome; they must not
  conceal unrelated journeys.
- No `try/catch` inside test callbacks unless absolutely necessary and specifically justified beside the code. Prefer
  awaited `.rejects`, `.toThrow`, and error matchers. Prepare a synchronous callable in Act and invoke it once in
  Assert. Do not hide routine exception handling in helpers to evade this rule. Use hooks/scoped fixtures for routine
  cleanup.

```ts
it('rejects a foreign note', async () => {
    const client = await app.authenticatedClient(otherUser);
    const path = '/notes/' + privateNote.getId();

    const response = await client.call(path);

    expect(response.status).toBe(404);
});
```

For `domain/` and `application/` unit tests:

- Never use `@nestjs/testing` or `Test.createTestingModule`.
- Instantiate the class/function directly.
- Provide small manual port doubles, in-memory implementations, or `vi.fn()` mocks only at architectural boundaries.
- Test observable business behavior rather than private implementation details.
- Keep tests deterministic; avoid real network, filesystem, Electron, clock, or database dependencies unless the test
  specifically targets an adapter/integration boundary.

### Infrastructure and persistence tests

Infrastructure adapters should be tested at their real boundary when useful. For SQLite/Kysely behavior, prefer
temporary isolated databases and verify relevant concerns such as migrations, constraints, persistence, ownership
filtering, and idempotent initialization.

Do not replace meaningful integration coverage with mocks when correctness depends on SQL, migrations, runtime
configuration, HTTP behavior, or Electron lifecycle.

### Test change rule

When production behavior changes, update or add the corresponding tests in the same change. A feature is not complete
merely because it compiles.

---

## 🔍 Implementation and Review Workflow

Before implementing a change:

- Inspect existing repository code, configuration, tests, and documentation before asking questions that the repository
  can already answer.
- Preserve decisions the user has already made.
- The current foundation plan generally takes precedence over older architecture context when they conflict. Explicit
  architectural decisions made later by the user supersede the plan; in particular, outbound ports belong in
  `application/ports/driven/`, not `domain/ports/`; entry contracts belong in `application/ports/driving/`.
- Ask for clarification when product behavior, scope, or a real architectural choice remains ambiguous and cannot be
  resolved from the repository.
- When asking, explain in simple terms what is unclear, what the practical options change, and which option is
  recommended.

Before finishing a code change:

- Use the repository's `.agents/skills/architecture-review/SKILL.md` to review the changes. Use it also when the user
  requests a review of manually added code.
- Check that each new backend file is in the correct feature and layer.
- Check resolved import targets and dependency direction, including type-only imports and re-exports.
- Check domain/application purity.
- Check constructor injection and port contracts.
- Check the class preference, including helper and utility classes and private methods for helpers used by one class.
- Check controllers do not bypass use cases or ports to access persistence directly.
- Check feature ownership and cross-feature dependencies.
- Enforce all five SOLID principles. Report demonstrated violations as mandatory findings with evidence, a concrete
  consequence, and the smallest correction. Optional advice concerns improvements beyond compliance.
- Run the relevant type-check, lint, format-check, unit, integration, and e2e tests available for the affected code.
- Distinguish **mandatory architecture violations** from **optional design improvements** when reviewing code.
- For a violation, report the location, practical consequence, and smallest appropriate correction.

Do not silently rewrite manually added code during a review-only task. Report findings unless the user explicitly asks
for modifications.

---

## ⚠️ Architecture Violation Policy

Do not knowingly generate code that violates SOLID or the dependency rules above just to complete a task faster.

If a requested implementation conflicts with an established architectural rule:

1. identify the conflict clearly;
2. explain the concrete consequence;
3. propose the smallest architecture-compliant alternative;
4. only change the architecture itself when the user explicitly chooses to do so.

Existing violations are not precedent for creating new violations.
