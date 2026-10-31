# Architecture migration plan and completion record

Status: implemented and verified locally. The original plan is retained below as the migration record.
[AGENTS.md](../AGENTS.md) defines the mandatory rules; [architecture.md](architecture.md) describes the implemented
layout. The initial documentation was committed and pushed as `2af1906`; implementation is delivered in the follow-up
migration commit.

## Implementation outcome

- Moved 55 backend source/test files using `git mv`, retaining the existing `use-cases/` spelling and kebab-case folders.
- Separated driving web adapters, driven persistence/filesystem/security/runtime adapters, and config composition.
  Root HTTP construction lives in a driving adapter; root config owns Nest security/validation wiring. Electron keeps
  backend lifecycle/recovery ownership. Runtime helpers are private methods on their owning runtime class.
- Added 16 feature driving interfaces; authentication/session renewal retain their existing shared driving contracts.
  Controllers inject these contracts using registered string tokens; modules construct plain classes with factories.
- Segregated repository reader/writer, settings reader, and token issuer/verifier contracts for actual consumer needs.
  Aggregate contracts remain available to adapters and composition. Domain entities, value objects and exceptions
  remain pure and separate from storage records and HTTP contracts.
- Updated import resolution, desktop/runtime entry paths, fixtures and CLI architecture checks. Added 21 architecture
  regression cases. Vitest's recursive discovery and existing unit/API exclusions continue to cover the moved suites;
  no runner-pattern changes were needed. Obsolete local emitted files were removed before packaging.
- Reviewed mandatory SOLID, constructor injection, ownership, cross-feature dependencies, mapping and core purity.
  No unresolved mandatory findings remain in the changed scope. No product behavior or database migration was changed.

## Verification

| Check                                              | Outcome                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline typecheck and lint                        | Passed                                                                                                                                     |
| Baseline full test suite                           | 41 files, 388 tests passed                                                                                                                 |
| Final typecheck and lint                           | Passed                                                                                                                                     |
| Final full test suite (`npm test`)                 | 41 files, 409 tests passed, including 68 architecture checks, controller HTTP, real SQLite and Electron lifecycle/desktop suites           |
| Formatting of changed files and `git diff --check` | Passed                                                                                                                                     |
| Review-skill structure validation                  | Passed                                                                                                                                     |
| `npm run package:dir`                              | Passed on Windows                                                                                                                          |
| `npm run test:packaged`                            | Passed: saved web port, HTTP/assets, native SQLite, graceful close, restart and persistence outside the checkout                           |
| `npm run check`                                    | Stops at pre-existing formatting differences in 54 untouched files; baseline had 114 failing files. The full test suite was run separately |

Unrelated staged server-settings helper files were preserved and excluded from the documentation commit. Repository-wide
formatting cleanup remains separate from this migration; no lint or architecture enforcement was disabled.

## Decisions carried into implementation

- All five SOLID principles are mandatory. Assess actual responsibilities/contracts without speculative abstractions.
- Keep business features at `apps/server/src/`: `identity`, `notes`, and `server-settings`.
- Move transport and composition into infrastructure with distinct driving, driven, and config boundaries.
- Require kebab-case for all project-owned folders and production source basenames: dashes between words, never
  underscores. Preserve required tool-defined names. Use `application/use-cases/`, `domain/value-objects/`, and
  `third-party/`. Retain `.usecase.ts`,
  `.interface.ts`, other existing role suffixes, and complete sibling test names.
- Every use case implements a pure driving interface. Outbound capabilities use driven ports.
- Nest modules define string tokens and wire plain classes through port-typed factory providers.
- Keep Zod/Nest Standard Schema, Kysely/SQLite, relative NodeNext `.js` imports, Vitest, and Electron-managed runtime.
  No new ORM, business IPC API, or standalone production server.

## 1. Inventory and baseline

Inspect the working tree and preserve unrelated changes. Record baseline typecheck, lint, formatting, architecture,
unit and API test results. Run full checks where the graphical environment permits; distinguish existing failures.
Inventory each backend source/test by feature, layer, adapter direction, and config responsibility. Include root/shared
files, API fixtures, desktop imports and tooling paths. Inspect actual port consumers rather than blindly moving files.

## 2. Update enforcement alongside the source migration

Update `tools/architecture/plugin.mjs`, `config.mjs`, `boundaries.spec.ts`, and test-convention utilities/suites with
source migration. If a temporary compatibility classifier is necessary between commits, remove it before completion.
Do not disable checks or broadly allow dependencies merely because both adapters now live under infrastructure.

Required accepted/rejected CLI fixtures include:

- Accepted driving Nest controllers/config modules and plain driven adapters in their target locations.
- Rejected NestJS imports/decorators in domain, application and driven adapters, including type-only imports.
- Rejected controller/guard access to driven implementations within the same infrastructure parent.
- Rejected driven-to-driving/config and driving-to-config dependencies; composition alone wires adapters.
- Rejected cross-feature infrastructure access, browser/backend coupling, core transport/row shapes, aliases,
  dynamic import bypasses, re-exports and normalized/alternate-path bypasses.
- Accepted narrow cross-feature inner contracts, focused shared adapters, root config/health exceptions, desktop
  imports of root bootstrap/recovery, and valid deep relative `.js` imports.
- Required nested port ownership/naming, kebab-case folders, same-directory unit/API pairing and one use-case operation.
  No placeholder tests for interfaces or data-only types.

Structural checks complement mandatory SOLID review; do not claim static analysis proves all five principles.

## 3. Migrate domain and application contracts

Move identity user and note entities/tests into their `domain/entities/` directories, and server-settings value
objects/tests into `domain/value-objects/`. Classify shared failure/authorization behavior by role; retain genuinely
shared pure contracts and place business exceptions in `exceptions/` where appropriate. Application services/testing
support retain focused ownership rather than being forced into use-case or port directories.

Retain each existing `application/use-cases/` directory and complete source/test basenames. Add a
focused driving interface per use case with its single operation and pure input/output contracts, then implement it
explicitly. Use one interface per kebab-case `<interface-name>.interface.ts` file, imported directly. Keep HTTP DTOs,
Zod schemas and persisted records outside these contracts.

| Existing contracts                                                                                                | Target classification                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Note/user repositories, password hashing, token signing/verification, settings/TLS stores, certificate validation | Owning feature `application/ports/driven/`                                      |
| Shared clock and ID generation                                                                                    | `shared/application/ports/driven/`                                              |
| Shared authentication/session-renewal operations called by transport                                              | `shared/application/ports/driving/`                                             |
| Identity session claims                                                                                           | Pure application data type near its owning contract, not a fake capability port |
| New per-use-case entry interfaces                                                                                 | Owning feature `application/ports/driving/`                                     |

Verify authentication/renewal sharing against actual callers. Implement shared entry contracts alongside feature entry
contracts where required, preserving substitutability without importing another feature's infrastructure. Data-only
types need no empty implementation/test.

## 4. Migrate driven adapters and persistence mapping

Move Kysely user/note/settings repositories and shared database/migration code to their owning
`infrastructure/adapters/driven/persistence/` directories with relevant tests. Preserve schema history and stored data.
Repositories own both mapping directions and preserve domain invariants during rehydration; ports expose no row types.
Extract persistence mappers only for a current need.

Place hashing, session signing, signing-key storage, TLS filesystem storage, certificate validation, private storage,
system clock and UUID generation in focused driven subdirectories by responsibility. Feature-specific adapters stay
with their feature. `third-party/` is for external APIs, not all technical behavior. Preserve constructor injection,
permissions, errors and observable contracts across adapters and doubles.

## 5. Migrate driving adapters and composition

Move feature controllers and colocated `.controller.e2e-spec.ts` files to
`infrastructure/adapters/driving/web/`. Move shared HTTP guard, sessions, login limiter and failure filter into the
shared driving web boundary. Preserve endpoint paths, validation, errors, sessions, CSRF and ownership. Controller
constructor types consume driving interfaces through explicit providers.

Move feature Nest modules into `infrastructure/config/`. Define module-owned string tokens for interface-backed
driving/driven providers. Use `useFactory`/`inject` with port-typed parameters to construct plain classes. Retain useful
dynamic registration semantics. Controllers may inject the registered string literal with the driving-interface type
to avoid a cycle through their composition module. API startup tests catch token mismatches.

Move root `presentation/bootstrap.ts` and `recovery.ts` into root `infrastructure/config/`. Split HTTP setup into a
driving `http-application.adapter.ts` and config `http-application.module.ts`; move health controller/tests into root
`infrastructure/adapters/driving/web/`. Keep startup
configuration in config and transport behavior in driving adapters. Update desktop worker/recovery entry imports and
tooling paths while preserving Electron lifecycle ownership.

## 6. Update imports, discovery, fixtures and runtime paths

Update resolved relative imports, including `.js` specifiers and colocated tests. Inspect `vitest.config.ts`, root
scripts, all TypeScript configs, `tools/dev.mjs`, runtime harnesses, desktop worker, API fixture composition,
persistence tests and packaged smoke tooling for path assumptions.

`test:unit` currently excludes all `**/infrastructure/**`: moving controller suites under infrastructure must not hide
them from `test:api` or remove real adapter integration coverage. Preserve test/support exclusions from production
builds, and discover colocated controller suites plus retained runtime API suites. Fixtures consume typed ports with
real isolated storage; fixture/config composition constructs implementations.

## 7. Review mandatory SOLID and verify behavior

Use the updated architecture-review skill to review affected classes/contracts and relevant callers/doubles. Correct
concrete SRP/OCP problems, unused interface capabilities, substitutability failures and dependency inversion with the
smallest compliant change. Avoid speculative factories, base classes or strategies. Clarify product behavior before
expanding the migration to changes that alter it.

Run typecheck, lint, formatting, architecture fixtures, focused core unit tests, real SQLite integration tests,
controller API suites and Electron lifecycle/desktop tests. Run `npm run check` after targeted checks pass. Validate
changed runtime entry paths with `npm run package:dir` and `npm run test:packaged` where supported. Record unavailable
platform/graphical checks and existing failures accurately.

Completion requires unchanged HTTP/security/storage/lifecycle behavior, complete test discovery, passing target
boundary fixtures, no legacy production presentation paths, underscore-separated project folders, or unsplit capability-port folders, and no
unresolved mandatory SOLID findings in scope. Update docs to describe implemented reality; remove migration caveats
only after verification. Keep the Claude redirect free of duplicated project rules.
