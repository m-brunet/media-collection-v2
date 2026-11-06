# Task 3 — Collections

Status: done (2026-11-05). Committed locally, not pushed. Global plan: [implementation plan](implementation-plan.md).
Owning docs: [collections](../collections.md) (authoritative rules and acceptance examples 1-12), [collection-editions-impact](../collection-editions-impact.md),
[features](../features.md) (Collections, Lists/search/sorting), [locations-tags-search](../locations-tags-search.md) (collection listing part),
[book-entry](../book-entry.md) (name matching).
Design: `design/artifact/screens/` yUD6M (Collections list), yJXFw (empty), C68ok (details, unfinished), zq1kt (details,
Finished), K8bbtH (Edit collection: rename + volume 0), LLSI1 (planned edition conflict), kz30p (omnibus conflict),
tr7ll/FOZxg (collection block of the book form).

## Scope

In: collection identity created/joined from the book form; single-volume and omnibus coverage; volume 0 option;
expected range, inferred and missing volumes, distinct Owned counts; Finished/reopen (manual and automatic); overlap
rules on create, edit, ownership change and move, with the explicit conflict resolutions; rename, volume-0 option,
delete; automatic removal of empty collections; Collections list (name sort, simple search) and details page with
expandable volume entries; collection shown on book details and searchable from My books; EN/FR; audit.
Out: advanced filters on collections (Task 4), Leaf shopping and mobile quick add (Task 7), Activity rendering (Task 8),
multiple membership, merging, unnumbered specials.

## Decisions (technical, within the specs)

- **Feature `collections`** (new, visible at the backend root) owns the Collection entity, the pure coverage rules, its
  endpoints and pages. Membership (collection id + volume range) is stored on the book, because a book belongs to at
  most one collection. Books saves call collections through one narrow driven port declared by `books`
  (`CollectionMembership`: resolve/validate a membership for a book being saved, then tidy affected collections), wired
  in the composition root to a collections application service. Same transaction as the book save. Confirmed by the user.
- **Coverage** value object: integer `from..to`, `from >= 0`, `to >= from`; single volume when equal. Pure domain service
  `CollectionCoverage` computes, from a collection's members (ownership + range): start (0 or 1), highest saved volume
  (any ownership, omnibus end included), expected range, distinct Owned volumes, missing volumes (saved Not Owned vs
  inferred), last owned, and overlap conflicts. Acceptance examples 1-12 become its unit tests.
- **Overlap**: Owned may overlap Owned; any overlap involving a Not Owned book is a conflict. Checked on create, update,
  ownership change and collection move. A conflict rejects the whole save with `409` and reason `coverage-conflict`,
  details `{ conflicts: [{ bookId, title, isbn, from, to, ownership }], resolvable }`. Resolvable only when the saved
  book is Owned and every conflicting book is Not Owned:
  - one planned record: **Update planned record and mark Owned** (the form switches to editing that book with the
    draft's edition information, ownership Owned; the user sees the replaced values before confirming; a normal
    `PUT /api/books/:id`), or **Delete planned record and add** (resubmit with `replacePlanned: [ids]`), or Cancel;
  - several, or a partial overlap: Delete-all-and-add or Cancel, with the "expected range may shrink to N" warning.
  The server deletes `replacePlanned` books in the same transaction only if they are exactly the current conflicting
  Not Owned set. Nothing is ever trimmed or split.
- **Name matching**: as authors (`NameKey`, same similarity). Equal key joins the collection; a similar name rejects with
  `collection-similar` + candidates; the form resubmits `{ id }` or `{ name, distinct: true }`. Rename to an equivalent
  existing name: `409 collection-name-taken`.
- **Volume 0**: saving coverage of 0 while the option is off rejects with `volume-zero-disabled`; the form asks, then
  resubmits with `enableVolumeZero: true` (also for a collection being created). Disabling the option while a book
  covers 0: `409 volume-zero-in-use`.
- **Finished**: stored flag. `POST /finish` only when nothing is missing (`409 collection-incomplete`); `POST /reopen`
  always allowed. After any change to a collection's members or its volume-0 option, a Finished collection with missing
  volumes is reopened in the same transaction. Never set automatically.
- **Lifecycle**: a collection is created by the first book saved with a new name; after any book delete, move or unlink,
  a collection without books is deleted. `DELETE /api/collections/:id` clears membership of its books and deletes it.
- **Persistence**: migration `007-collections`: `collections` (UUID `id` with the CHECK of migration 006, `name`,
  `name_key` unique, `includes_volume_zero`, `finished`, `created_at`, `updated_at`); `books` gains nullable
  `collection_id` (FK, indexed), `volume_from`, `volume_to` (all three null or all set, enforced in the domain and by a
  CHECK). Kysely builders only; raw SQL stays inside the migration.
- **API**: `GET /api/collections?search&order=asc|desc&page` (48 per page, Load more; rows carry name, owned/expected,
  missing count, finished); `GET /api/collections/:id` (summary + volume entries: each numbered volume with its covering
  books, consecutive inferred volumes grouped as one range entry); `PATCH /api/collections/:id` (name,
  includesVolumeZero); `POST /api/collections/:id/finish`, `POST /api/collections/:id/reopen`;
  `DELETE /api/collections/:id`. Book input gains `collection: { id } | { name, distinct?, enableVolumeZero? } | null`
  with `volumeFrom`, `volumeTo`, plus `replacePlanned?: string[]`. Book views gain `collection: { id, name, from, to }`.
- **Search**: collection listing search matches the collection name or any member book's title, author, ISBN (same
  rules as My books). My books simple search also matches the collection name (features.md). Counts always describe
  the whole collection.
- **Permissions**: every signed-in account reads; Owners/Admin edit, finish/reopen, delete (`requireLibraryEditor`).
- **Audit**: `collection.updated` (rename / volume-0 option), `collection.finished`, `collection.reopened`,
  `collection.deleted` (shared, Activity-eligible). Book snapshots gain `collectionId`, `volumeFrom`, `volumeTo`; implicit
  creation, automatic reopen and empty-collection removal are recorded in the same book operation's after-state
  (`collectionChanges`), so Activity can describe them later.
- **Interface**: sidebar Collections page (list rows as in yUD6M: name, "4 / 12 volumes Owned", "8 missing ·
  Unfinished" / "No known missing volumes · Unfinished" / "Finished"); details page (header counts, expected range,
  volume-0 and highest coverage line, Edit collection dialog with rename, volume 0 and Delete collection with
  confirmation, Mark Finished with the unavailable explanation, Reopen); expandable volume entries listing each book
  ("Omnibus · Covers 1–3 · One book", "View this book"). Book form: "Part of a collection" checkbox, collection
  combobox (select or create), coverage Single volume / Covers several volumes, volume number or range. Book details
  show the collection and coverage linking to it. Guests see no editing controls.

## Steps

1. [x] Domain: Coverage value object, Collection entity, `CollectionCoverage` service; unit tests for examples 1-12.
2. [x] Persistence: migration 007 + SQLite tests (constraints, FK, upgrade of populated database); collection
       repository and read-side catalog; book repository/catalog carry membership.
3. [x] Application: membership port and service (resolve name, volume 0, overlap, `replacePlanned`, tidy/reopen/remove);
       create/update/delete book integration; collection use cases (list, get, update, finish, reopen, delete); unit tests.
4. [x] HTTP: collections controller, book schema changes; API e2e tests for every endpoint, roles, conflicts, audit.
5. [x] Libris: Collections list (search, sort, load more, empty/no-result/loading), details page, Edit collection and
       delete dialogs, book form collection block and dialogs (similar name, volume 0, planned conflict, omnibus conflict),
       book details collection line; EN/FR; component tests.
6. [x] Browser e2e: create a collection from the book form and see counts; omnibus + overlap counting; Not Owned
       conflict resolved by deleting the planned record; Finished, automatic reopen, manual reopen; rename/collision;
       delete collection keeps books; last book moved removes collection; Guest read-only.
7. [x] Docs, full check, architecture review, commit, plan status.

## Decisions confirmed by the user (2026-11-05)

1. Separate `collections` feature with a narrow port used by `books`.
2. Delete collection lives in the Edit collection dialog, with a confirmation that the books are kept.
3. Collections list pages by 48 with Load more.

## Changes from the plan made during implementation

- Membership lives in its own `collection_books` table (composite key book + collection, unique book index), written
  only by collections adapters, instead of columns on `books`: `books` stays unaware of coverage and multiple membership
  remains possible. Read adapters join across feature tables; writes stay with the owning feature (documented in
  [architecture](../architecture.md)).
- Coverage lives in the value objects `VolumeRange` and `CollectionCoverage` (domain/value-objects) rather than a domain
  service. The membership ports are `CollectionMembership` (`assign(book, request, replacing)`, `leave(bookId)`) and
  `BookCollectionReader` (`of(bookId)`), split after the architecture review (ISP); the books use
  cases delete replaced planned books themselves (`BookRemoval`), after `assign` accepted the replacement.
- Collection choice in the form is by name only (suggestions from `GET /api/collections/names`); "Join <name>" in the
  similar-name dialog resends the existing name. Book input still accepts `{ id }`.
- Audit: book snapshots carry `collection` ({ id, name, volumeFrom, volumeTo }) and `replacedPlanned`. Follow-up
  (2026-11-05, user decision: collections appear in Activity): automatic collection changes are their own audit
  records in the book operation (same operation ID and actor): `collection.created`, `collection.updated` (volume 0
  included from the book form), `collection.reopened`, `collection.removed` (emptied; distinct from a person's
  `collection.deleted`). `AuditedChange.related` carries them; `RelatedChange` is in `audit-entry.interface.ts`.
- "Update planned record" resends the draft as `PUT /api/books/<planned id>` with ownership Owned, then follow-ups
  (reading status, note, cover) on that record.

## Notes for later tasks

- Collection listing search goes through `CollectionBookSearch` (books catalog) and returns collection ids; Task 4's
  advanced filters should extend that search so a collection matches only when one book satisfies the whole expression.
- Leaf shopping (Task 7) can build on `CollectionCoverage` (`missing`, `lastOwned`, volume states) and
  `GET /api/collections/:id`; quick add is a normal `PUT /api/books/:id` with ownership Owned.
- Overview counters (Task 8): `GET /api/collections` total gives the collection count.
- Volumes are integers 0-9999.

Later (2026-11-06): the Libris Collections pages were brought back to the design (cards with cover previews,
callouts, volume cards, editions with covers); see [design-fix-collections](design-fix-collections.md).
