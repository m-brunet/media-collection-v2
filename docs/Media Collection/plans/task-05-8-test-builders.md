# Task 5.8 — Test entity builders

Status: planned (2026-11-06), awaiting user approval. Inserted at the user's request between Tasks 5 and 6.
Global plan: [implementation plan](implementation-plan.md). Origin: optional review point 1 of
[Task 5](task-05-lending.md) (duplicated API test helpers) and the user's reference to test builders.

## Goal

Build valid domain entities for tests in one readable line, and save them when a test needs them stored, the same
way in unit tests (in-memory repositories) and API/persistence tests (SQLite). Builders only arrange preconditions:
a test about a business rule still goes through the use case or the endpoint.

## What we keep from test builders, and what changes

Kept:
- Fluent builders: `with…` sets one property; `as…` sets several at once to reach a coherent state
  (`asReturned(date)`, `asPlanned()`), so arranged entities respect the entities' invariants by construction.
- `build()` returns the entity without storing it; `buildAndSave(...)` stores it, creating missing parents first
  (a loan without a book or receiver gets default ones).
- One entry point exposing every builder, here `TestLibrary`.

Changed (decided with the user, 2026-11-06):
- **Save through the application's repository ports, never raw inserts.** The repository's real mapping is reused, a
  builder cannot store a row the application could not read back, and schema changes stay in the adapters. This is
  also the `AGENTS.md` rule for API fixtures (typed application ports).
- **One builder for every level.** Memory doubles and Kysely repositories implement the same ports, so
  `buildAndSave(ports)` serves unit tests and API/persistence tests alike.
- **Deterministic defaults**, no random data: fixed values, counters for unique values (titles, ISBNs, names).
- Browser end-to-end tests keep arranging data over HTTP (the application runs as its own runtime).

## Design

- Base class `EntityBuilder<TEntity, TPorts>`: `build(): TEntity`, `buildAndSave(ports: TPorts): Promise<TEntity>`,
  protected defaults. Builders are classes (class preference); `with…`/`as…` return `this`.
- Feature-owned builders next to the feature's doubles, in `<feature>/application/testing/`, named
  `<entity>-builder.test-support.ts`, depending only on that feature's domain and ports:
  - books: `BookBuilder` (title, ISBN or none, authors by name, category, ownership `asPlanned()`, publication,
    cover file) saving the book and its authors through `BookRepository` and `AuthorRepository`;
  - lending: `ReceiverBuilder`, `LoanBuilder` (`of(book)`, `to(receiver)`, `lentAt`, `asReturned(at)`);
  - tags, locations, collections and identity (`UserBuilder`, replacing `user()` and backing `UserFixture`) follow
    the same pattern when touched.
- `TestLibrary` (cross-feature entry point, test support outside the features) composes the feature builders and
  resolves parents across features (a loan's book is built with `BookBuilder`). Its ports come from either the memory
  doubles or the API test context.
- API tests: `TestAppContext` exposes the lending repositories (receivers, loans) so `TestLibrary` can save there;
  builders can be loaded through `app.loadFixtures` like `UserFixture`.

## Scope

In: the base class, `TestLibrary`, builders for books, receivers and loans; API test context wiring; replacing the
duplicated lending helpers (`book`/`lend`/`lentTo`/`receiver`) in the loans, receivers and books controller specs and
the lending unit-test helpers (`receiver()`, `lent()`, the `loan()` factory) with builders; unit tests of the builders
themselves (defaults, `as…` states, parent creation, saving through memory ports); a short "how to arrange test data"
section in the architecture doc.
Out: converting every existing test at once (other features adopt builders when next touched, starting with Task 6),
browser e2e arrangement, production code changes.

## Steps

1. [ ] Base class and lending builders (`ReceiverBuilder`, `LoanBuilder`) with their unit tests; convert the lending
       unit tests.
2. [ ] `BookBuilder` with its unit tests; `TestLibrary` composing books and lending, with parent creation.
3. [ ] API test context: lending repositories; convert the loans, receivers and books controller specs' lending
       helpers; check the architecture tests accept the test-support imports.
4. [ ] Docs (architecture: test data arrangement), full check, architecture review, commit, plan status.

## Questions for the user

1. **Where `TestLibrary` lives.** It crosses features (a loan needs a book), which feature code may not do. Recommended:
   `tests/support/test-library.ts`, outside `apps/server/src`, importing the feature builders; the feature builders
   stay feature-owned. Alternative: one builder folder per feature only, and tests compose parents by hand.
2. **`UserFixture`.** Recommended: keep it working as is in this task, and move it onto a `UserBuilder` when identity
   tests are next touched.
