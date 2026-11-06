# Task 5.5 — Generated titles for collection Manga and Comics

Status: technical design approved (2026-11-06), in progress on `master`. Business rules confirmed (2026-11-06).
Global plan: [implementation plan](implementation-plan.md).
Owning docs: [book-entry](../book-entry.md#collection-based-titles) (authoritative title rules and acceptance examples),
[features](../features.md) (Books), [collections](../collections.md) (membership, rename and deletion).

## Scope

In: conditional title input for collection Manga/Comics; mandatory persisted titles; backend generation and explicit
provenance; regeneration on collection/membership/coverage changes; individual-edit confirmation and collection-deletion
preservation; current V2 schema upgrade; HTTP contracts, Libris forms, EN/FR feedback, audit, search/sort and tests.

Out: V1 database import, dump corrections, importer tooling or migration scheduling; automatic category correction;
external title recovery; new collection or lending workflows. Tasks 6 and 7 adopt the rules for assisted entry and Leaf.

## Business rules

- Books and standalone Manga/Comics require supplied nonblank titles. Collection Manga/Comics may leave input blank;
  trim whitespace before deciding. Other mandatory metadata and membership/coverage validation still apply.
- Generate in the backend using the current collection display name and coverage: `Collection name - N` for a single
  volume, `Collection name - N–M` for a range. Volume 0 follows the existing collection option. No localization-dependent
  word such as Tome or Volume is stored in the generated string.
- Keep the stored title nonblank. Persist `titleGenerated: boolean`; supplied titles use false, generated titles true.
  Identical text does not imply identical provenance. Existing V2 titles retain their text and receive false.
- Regenerate only generated titles on collection rename, membership move and coverage edits. Preserve supplied titles.
  Changing between Manga and Comics retains eligibility; unrelated updates retain provenance.
- Supplying a title clears the flag; eligible blank input selects generation. The edit contract must distinguish keeping
  generation from explicitly supplying the displayed fallback, including an identical string.
- An individual membership removal or category change to Books requires a supplied title. Prefill with the last
  generated title, allow replacement, and let one confirmation accept the prefilled value. Reject blank input; save
  with the flag false. Do not silently accept a generated-mode request after eligibility is lost.
- Whole-collection deletion is the exception: keep last generated titles, clear flags and membership/coverage
  automatically, preserving books. Retain all existing supplied titles.

## Domain, application and persistence

- Identify ownership before implementation: books owns title validity/provenance; collections owns membership and
  shared rename/delete orchestration. Collaborate through narrow pure ports; no cross-feature infrastructure imports.
- Keep generation and transition rules in inner layers, using focused classes/private methods as appropriate.
  Controllers perform transport validation/mapping; React provides feedback rather than authoritative generation.
- Add a new forward schema migration after Task 5's migrations: a non-null persisted flag constrained to boolean values,
  initialized false for existing rows. Update domain state, repository mapping, projections, fixtures and audit snapshots.
  Do not modify historical migrations or infer flags from title text. This is a V2 schema upgrade, not V1 import.
- Persist titles, normalized title keys, provenance, membership and affected collection changes atomically. A failure
  must leave no partially renamed titles or detached books. Apply existing length validation without silent truncation;
  account for a collection name plus the longest allowed range in generated-title length checks.
- Update generated titles on collection-wide rename and preserve titles/clear provenance on collection-wide deletion
  through appropriate contracts. Update affected books' update timestamps consistently; preserve creation timestamps.
- Preserve ISBN uniqueness, no-ISBN duplicate warnings, ownership/coverage safeguards and existing permissions.

## HTTP and interface

- Extend shared HTTP contracts and schemas with title provenance as required for reading/editing. Specify how input
  expresses retain-generation versus supply-title intent; server recomputes generated text from validated membership.
  A client cannot bypass title eligibility or submit arbitrary text as an authoritative generated title.
- Libris create/edit: show title optionality only for eligible category/membership, explain the fallback, preserve
  supplied text, and retain generated mode when editing unrelated fields. Clearing an eligible title enables generation.
- Losing eligibility makes title required and prefills the last generated value. One explicit save/confirmation can
  accept that text; no additional mandatory dialog. Preserve the draft on errors and existing discard confirmation.
- Reflect resolved titles in details, listings, search/sort, duplicate detection and lending pickers/active-loan search.
  Check Task 5's live-book reads and retained-history contract; do not rewrite past audit events or introduce a new
  historical-title policy. Collection rename must not leave current book-title projections stale.
- EN/FR labels explain optional/generated/required states. Future assisted lookup must preserve explicit supplied
  titles and generation intent under its existing conflict-confirmation rule; Leaf inherits the same business validation.

## Audit and validation

- Use existing audited operations for changes, including title/provenance before/after and affected-book changes for
  collection-wide operations. Retain failed outcomes without implying persisted partial changes. Do not invent a new
  Activity workflow or mutate historical audits.
- Focused Vitest unit coverage: both eligible categories, Books/standalone rejection, whitespace, volume 0, ranges,
  supplied titles, identical-text provenance, unrelated edits, regeneration, individual eligibility loss and bulk deletion.
- Same-directory controller API suites: real HTTP with shared TestingModule fixture, permissions, request validation,
  persistence round trips, collection rename/move/coverage/delete behavior and rollback on failure.
- Persistence integration: existing-record false backfill with unchanged titles, flag constraints, title-key consistency
  and atomic multi-record updates. Use isolated databases and current application ports for fixtures.
- Frontend component/e2e: conditional required input, generation feedback, unrelated edit retention, prefilled title and
  one-click acceptance on eligibility loss, clearing rejection, supplied title protection and save-failure draft retention.
- Regress lending title/search/history behavior and no-ISBN duplicate checks. Map cases to the owning acceptance examples.
- Before implementation completion, perform the required architecture-review skill and relevant format, lint, type,
  unit, API, persistence and web checks, including the repository's required full check.

## Technical design (approved 2026-11-06)

Written against the completed Task 5 code. Existing names: `Book`/`BookDetails` (title 1-300 characters,
`title-invalid`), `CreateBook`/`UpdateBook`, `BookDetailsBuilder`, `BookIdentityCheck`, `CollectionMembership.assign`
(returns the resolved `BookCollection { id, name, volumeFrom, volumeTo }`), `UpdateCollection` (rename),
`DeleteCollection`, `CollectionMemberStore`, the catalog's `books.title_key` (search and title sort).

### Ownership

- **books** owns the title, its provenance and generation: `BookDetails` gains `titleGenerated`; a pure domain value
  `GeneratedTitle.of(collectionName, volumeFrom, volumeTo)` formats `Name - N` / `Name - N–M` (hyphen-minus with
  spaces as separator, en dash without spaces in a range, display name kept as is); eligibility is a `Book` rule
  (category Manga/Comics **and** a collection membership).
- **collections** owns the collection-wide operations and declares one driven port, `MemberTitles`, implemented by a
  books application service and wired at the root (like `CollectionBookSearch`):
  - `regenerate(collectionName, members)` on rename: retitles members whose title is generated, returns related
    changes;
  - `release(bookIds)` before whole-collection deletion: clears the flag, keeps the text, returns related changes.
- Length: a collection name has at most 200 characters, so the longest generated title (200 + ` - 9999–9999`) is 212,
  under the 300-character title limit. No truncation case exists; a test pins this.

### Book saves (create and update)

- Input contract unchanged: `title: string`. **A blank (or whitespace-only) title means "generate"**; any nonblank
  text is a supplied title (flag false), even when identical to the generated one. Blank on a non-eligible book is
  refused with a new reason `title-required` ("Enter a title; only Manga and Comics in a collection get one
  automatically."). `title-invalid` stays for the length rule.
- Order in the transaction: build details (generated mode carries a provisional title) → save the book → assign the
  membership → if generated, set the final title from the **resolved** collection (an equivalent existing collection
  may be spelled differently from what was typed) and save again → run the no-ISBN duplicate check on the final title
  (moved after the membership; it excludes the book itself and a refusal rolls everything back).
- Moving to another collection or changing coverage regenerates a generated title. An unrelated edit keeps generation
  because the form sends a blank title for a generated book (see interface).
- Losing eligibility individually (membership removed, or category set to Books) with a blank title: `title-required`
  (no silent acceptance); the form prefills the last generated title, so one save supplies it.

### Collection rename and deletion

- `UpdateCollection` with a new name calls `MemberTitles.regenerate` with its members (it already reads them) and
  passes the returned changes as related audit changes.
- `DeleteCollection` calls `MemberTitles.release(memberIds)` before clearing the membership.
- Related audit records use one new category, `book.retitled` (subject: the book; before/after
  `{ title, titleGenerated }`), sharing the collection operation's ID, so Activity can group them under the rename or
  deletion. Book snapshots (`BookSnapshot`) gain `titleGenerated`.

### Persistence

- Migration `010-generated-titles`: `books.title_generated INTEGER NOT NULL DEFAULT 0 CHECK (title_generated IN
  (0, 1))`; existing rows get 0 (example 6). Repository mapping, catalog rows, member records unchanged otherwise.
- `title_key` is recomputed on every title change by the existing repository save (search stays consistent).
- See question 1 for title ordering.

### HTTP and Libris

- `BookDto` gains `titleGenerated`. List items, loans and collection views keep showing the stored title.
- Book form, Title field:
  - eligible (Manga/Comics with a collection): not required; hint "Leave empty to name it from the collection:
    Gunnm - 3" (computed live in the form for feedback only; the server decides).
  - editing a generated title: the field starts **empty** with that hint, so an unrelated edit keeps generation;
    typing any text, even the same one, makes it supplied.
  - losing eligibility (unticking the collection or choosing Books) while the field is empty: the field becomes
    required and is prefilled with the last generated title; saving accepts it in one click.
  - Book details show a small "Named from the collection" mark next to a generated title (provenance visible).
- EN/FR texts; `title-required` reason.
- Lending: active-loan and picker reads use the live title, so they follow regeneration; a loan's title copy is
  refreshed only at book deletion, as in Task 5. No change needed beyond regression tests.

### Steps

1. [ ] Domain: `GeneratedTitle`, `Book` title provenance and eligibility, `title-required`; unit tests (examples 1-6).
2. [ ] Persistence: migration 010 (+ question 1 if approved), repository mapping, SQLite tests (backfill, constraint).
3. [ ] Application: create/update ordering and regeneration, `MemberTitles` service and port, rename/delete
       integration with related `book.retitled` changes, snapshots; unit tests.
4. [ ] HTTP: `titleGenerated` in contracts, reasons; API e2e for books (create/edit/move/coverage/eligibility loss)
       and collections (rename regenerates, delete releases, rollback).
5. [ ] Libris: title field states, details mark, EN/FR; component tests.
6. [ ] Browser e2e: blank-title Manga in a collection, rename regenerates, removal prefill accepted in one click,
       collection deletion keeps titles; lending regression.
7. [ ] Docs (architecture: `MemberTitles`, migration 010), full check, architecture review, commit, plan status.

### Decisions confirmed by the user (2026-11-06)

1. Titles sort naturally (numbers by value) for every book: a `title_sort_key` column with digit runs zero-padded,
   backfilled by migration 010; the catalog's title sort uses it.
2. Format: `Name - N`, `Name - N–M` (en dash, no spaces), `Name - 0` with volume 0, collection display name as is.
3. Two editions generating the same title keep the existing, overridable "possible duplicate" warning.

## Delivery and dependencies

Implement after Task 5, before Task 6; leave the Task 5 implementation and its plan intact. Tasks 6–7 consume these
rules rather than reinstating unconditional title input. Task 8 reads consistent titles/audits; Task 9 backs up the new
flag with the database. Choose detailed contracts/wiring after inspecting completed Task 5 code.

- [ ] Finalize technical contracts and schema migration against completed Task 5.
- [ ] Implement inner rules, persistence and atomic cross-feature updates.
- [ ] Update HTTP contracts, Libris EN/FR forms and dependent reads.
- [ ] Complete acceptance coverage, architecture review and required checks.
- [ ] Record completion and handoff notes in the global plan.

No pending product question remains from this discussion. Technical planning must preserve the confirmed prefilled
confirmation behavior and bulk-deletion exception; V1 import is a separate future discussion.
