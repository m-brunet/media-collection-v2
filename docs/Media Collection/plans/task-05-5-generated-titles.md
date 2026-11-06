# Task 5.5 — Generated titles for collection Manga and Comics

Status: not started. Business rules confirmed (2026-11-06); implementation remains future work.
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
