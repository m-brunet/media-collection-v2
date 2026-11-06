---
name: architecture-review
description: Review code in this Electron foundation for mandatory SOLID principles, Screaming Architecture and pure hexagonal boundaries. Use when checking manually added code, reviewing a diff, or before finishing code changes in this repository.
---

# Architecture review

Read root `AGENTS.md` and `docs/Media Collection/architecture/architecture.md` first. Their current rules and explicit user decisions take precedence
over older planning context. Establish whether the user wants findings or fixes; a review-only request authorizes
findings, not edits.

Identify the requested scope. For a coding task, inspect the task's changes and relevant callers, ports, tests and
composition. For manual code, use the paths or diff the user specifies. Inspect repository facts before asking
questions. If behavior or ownership is still unclear, explain the uncertainty and the practical options in simple terms,
then ask; do not invent a product requirement.

## Mandatory checks

1. Identify each backend file's owning feature and layer. Business invariants belong to domain entities or pure domain
   services; a use case represents one action. Require `domain/entities`, `domain/value-objects`, `domain/exceptions`,
   `application/use-cases`, `infrastructure/adapters/driving/web`, `infrastructure/adapters/driven/persistence`, and
   `infrastructure/config` for their respective responsibilities. Features remain visible at the backend source root;
   use driving/driven terminology. Root composition and shared adapters follow the exceptions in `AGENTS.md`.
2. Trace resolved import destinations, including relative paths with many `../` segments, `.js` specifiers that resolve
   to TypeScript, re-exports and type-only imports. First-party imports are relative. No aliases or dynamic backend
   imports bypass the rules.
3. Domain/application are pure TypeScript: no NestJS, Kysely, SQLite, Node, Electron, React, Zod, transport contracts or
   database rows. Domain does not import application ports. Entry interfaces live in `application/ports/driving`,
   outbound interfaces in `application/ports/driven`; string DI tokens live in the owning config module.
   Each use case implements a driving interface; transport adapters consume that contract.
4. Entities, use cases and adapters use plain constructor injection. Driven adapters have no NestJS imports/decorators.
   NestJS belongs only in driving adapters/config. Controllers and guards never access driven implementations. Only
   config modules/bootstrap compose adapters, with string tokens and factory providers whose parameters use port
   types. Verify controller token literals agree with registration without introducing module/controller import cycles.
5. Cross-feature collaboration uses narrow application/shared contracts. A feature must not access another feature's
   infrastructure. Browser code imports only browser code and transport contracts. Electron owns the backend lifecycle;
   business operations use HTTP, with IPC limited to lifecycle/offline recovery.
6. Check ownership, authorization, invariant enforcement and port behavior against actual implementations and test
   doubles. An administrator cannot read another account's private data (for example personal book notes). Password/token rules and recovery constraints
   must not depend on UI enforcement.
7. Require pure domain entities distinct from persistence records/models. ORM decorators and row shapes stay in
   driven persistence. Repositories own read/write mapping, optionally through a local mapper; rehydration preserves
   invariants. Do not introduce an ORM to satisfy separation in this Kysely project. Business exceptions stay pure;
   HTTP translation stays in driving web adapters.
   Verify focused `.spec.ts` tests for entities/use cases/pure helpers and HTTP `.e2e-spec.ts` coverage for every
   endpoint. SQL and relevant lifecycle tests exercise real storage and Electron. Core unit tests instantiate classes
   directly, without Nest testing utilities.
8. Require production role suffixes from `AGENTS.md`: `.interface.ts` for one interface per file in
   `application/ports/` only; `.service.ts`, `.repository.ts`, `.adapter.ts`, `.helper.ts`, `.entity.ts`, `.util.ts`,
   `.controller.ts`, and `.usecase.ts` for files with those actual roles. Do not infer that every interface in the
   repository belongs in a separate file or that every domain type is an entity. Check direct imports, kebab-case
   interface filenames, and role/test naming together. All project-owned folders use kebab-case with dashes between
   words, never underscores; preserve required tool-defined names.
9. Require exact same-directory source/test pairing: `<name>.usecase.ts` / `<name>.usecase.spec.ts` for use cases,
   `<name>.entity.ts` / `<name>.entity.spec.ts` for entities, other executable core sources with matching `.spec.ts`,
   and `<name>.controller.ts` / `<name>.controller.e2e-spec.ts` for controllers. Check runner discovery and test type
   checking. Type-only files and integration/support files are classified by responsibility, not suffix alone.
10. Each use-case class has its own responsibility-focused file and exposes one public business operation. This is a
    scoped project convention, not a general SRP method-count rule: services, repositories, and entities may expose
    multiple cohesive operations. Assess responsibility by what changes the behavior and who owns that change.
    Single-class helpers are private methods; shared behavior has a focused feature-owned utility/service and
    appropriate constructor injection. Preserve application/domain purity and production composition ownership.
11. Review every changed test case for visible, unlabeled Arrange/Act/Assert blocks and one operation/behavior under
    test. Controller cases make one request in Act; assertions inspect its outcome only. Fixtures prepare prerequisites
    without hiding tested journeys. No routine try/catch in callbacks; necessary exceptions need a concrete inline
    justification. Prefer rejection/throw matchers and reliable hook/fixture cleanup.
12. Controller API suites use the shared `tests/api/setup/test-app.ts` Nest TestingModule-backed application and
    reusable `tests/api/fixtures` for persisted prerequisites. Verify production-equivalent
    middleware/guards/validation, real isolated SQLite, typed port access, session/CSRF preparation, ordered fixture
    loading, and cleanup after failure. Preserve actual Electron lifecycle tests and direct-construction core unit
    tests.

Source and automated enforcement follow the driving/driven/config layout. Consult
`docs/Media Collection/architecture/architecture-migration-plan.md` for the migration record and known baseline limitations. Do not treat shared
infrastructure ancestry as permission for driving/driven/config boundary crossings.

Run relevant repository checks for code changes when execution is available: `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run test:architecture`, and the affected tests. Record failures or unavailable checks accurately. A review-only
task does not authorize formatting or rewriting code.

## Mandatory SOLID checks

Tests use separate, explicitly named `it`/`test` cases. Reject `it.each`/`test.each` and test-registration loops unless
the user explicitly requests parameterized tests. Shared setup helpers may reduce duplication while keeping each
scenario visible.

All five principles are requirements. Review changed responsibilities and relevant callers/implementations; report
demonstrated violations as mandatory findings:

* SRP: one reason to change; separate unrelated business actions, transport, persistence and composition concerns.
  Cohesive entities/repositories may expose multiple operations; method count alone is not a violation.
* OCP: actual interchangeable behaviors have an extension mechanism rather than accumulating selection branches.
  A conditional alone is not a violation; identify the current variation and change pressure.
* LSP: implementations and doubles preserve return, error, ownership and mutation contracts, without stronger
  preconditions or weaker guarantees. Check observable behavior, not only TypeScript assignability.
* ISP: clients depend on capabilities they need; split contracts when consumers have distinct needs.
* DIP: core behavior depends on pure capability contracts. Framework/runtime/persistence adapters implement those
  contracts; config owns composition.

Explain evidence, practical consequence, and the smallest correction. Optional suggestions concern improvements
beyond compliance; never relabel a demonstrated SOLID violation as optional advice.

Apply the class preference in `AGENTS.md` to new or modified production behavior, including reusable helpers and
utilities. Prefer focused classes with constructor-injected dependencies; pure, stateless helpers/utilities may use
static methods. Helpers used by one class stay private methods. Preserve function forms for React functional
components/hooks, API callbacks and NestJS factory providers, with reusable behavior owned by classes.

Do not require interfaces, factories, inheritance, strategies or new shared abstractions for hypothetical future needs.
A single implementation may still need a port to keep framework or persistence details outside a use case.

## Report

Lead with mandatory findings ordered by impact. Each finding includes a file/line, violated rule, practical consequence,
and smallest appropriate correction. Put optional design improvements separately and label them optional. Include
relevant checks and unresolved assumptions. If no mandatory violations were found, state that directly; do not invent
findings to fill the report.

Fix only when the user requested implementation/fixes. Keep corrections within the owning feature and rerun affected
checks. Do not weaken guards or change established architecture to make a check pass.
