# Task 5.8 — Test entity builders

Status: done (2026-11-06), committed on `master`. Inserted at the user's request after Task 5.
Global plan: [implementation plan](implementation-plan.md). Origin: optional review point 1 of
[Task 5](task-05-lending.md) (duplicated API test helpers) and the user's reference to the welii test builders
(`weliihq/welii`, `apps/backend/src/_tests_/builders`, `PureTestBuilder`).

## Goal

Build valid domain entities for tests in one readable line, and save them when a test needs them stored, the same
way in unit tests (in-memory repositories) and API/persistence tests (SQLite). Builders only arrange preconditions:
a test about a business rule still goes through the use case or the endpoint.

## What we keep from welii, and what changes

Kept:
- Fluent builders: `with…` sets one property; `as…` sets several at once to reach a coherent state
  (`asReturned(date)`, `asPlanned()`), so arranged entities respect the entities' invariants by construction.
- `build()` returns the entity without storing it; `buildAndSave(...)` stores it, creating missing parents first
  (a loan without a book or receiver gets default ones).
- One entry point exposing every builder (welii's `PureTestBuilder`), here `TestLibrary`.

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

1. [x] Base class and lending builders (`ReceiverBuilder`, `LoanBuilder`) with their unit tests; convert the lending
       unit tests.
2. [x] `BookBuilder` with its unit tests; `TestLibrary` composing books and lending, with parent creation.
3. [x] API test context: lending repositories; convert the loans, receivers and books controller specs' lending
       helpers; check the architecture tests accept the test-support imports.
4. [x] Docs (architecture: test data arrangement), full check, architecture review, commit, plan status.

## Implementation changes (vs. the plan)

- **`TestLibrary` lives in `tests/api/fixtures/test-library.ts`, not `tests/support/`.** The architecture lint lets
  controller specs import test code from `tests/api/` only; widening that rule would weaken an architecture check.
  The location still honours decision 1 (outside the application source, feature builders stay in their features).
- Feature boundaries apply to tests: a lending controller spec may not import the books builder, so
  `TestLibrary.book()` also accepts plain `BookFacts` (title, authors, ISBN, publisher, year, planned).
- `LendingArrangement` (`tests/api/fixtures/lending-arrangement.ts`) replaces the three API specs' HTTP lending
  helpers: it lends books (given as a loan records them) to a receiver and records returns through the builders,
  dated in December 2025 a minute apart, before the test application's own clock.
- Builders use `TestIds` (deterministic UUIDs accepted by the SQLite checks) since application test support must stay
  pure (no `node:crypto`). Domain specs keep their local factories: builders are application test support.
- The API test context exposes `lending: { loans, receivers }` and `builders: TestLibrary`.

## Decisions confirmed by the user (2026-11-06)

1. `TestLibrary` lives in `tests/support/test-library.ts`, outside the application source; feature builders stay in
   their features' `application/testing/` folders.
2. `UserFixture` stays as is in this task; it moves onto a `UserBuilder` when identity tests are next touched.

## Architecture review (2026-11-06)

No mandatory findings; no production code changed. Builders are pure application test support (enforced by the
lint), cross-feature arrangement stays under `tests/api/`, and every builder has its same-directory spec.

## Notes for later tasks

- Use `app.dependencies.builders` (API tests) or the feature builders with the memory doubles (unit tests) to arrange
  data; add `with…`/`as…` methods as scenarios need them, and builders for other features when their tests are next
  touched (Task 6 adopts them first). `UserFixture` moves onto a `UserBuilder` when identity tests are touched.
- Collection membership, shelves and tags are not built yet; a `TestLibrary` method per feature is the natural place.

