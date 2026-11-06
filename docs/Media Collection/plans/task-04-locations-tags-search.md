# Task 4 — Locations, tags and advanced search

Status: done (2026-11-05). Committed and pushed (ddf3f0f). Global plan: [implementation plan](implementation-plan.md).
Owning docs: [locations-tags-search](../locations-tags-search.md) (authoritative rules, acceptance examples 1-14), [features](../features.md)
(Physical locations, Tags and filtering, Lists/search/sorting, permissions table).
Design: `design/artifact/screens/` ZRBZB (Bookshelves), g7I2l (Bookshelves empty), ty6Jg (Create shelf, also used for
Move shelf), q84uEO (Delete shelf), R60eQ2 (Tags), y41k8 (Delete tag), q2GzCK (Advanced book filters), FFPyb (filters,
Guest), FOZxg/tr7ll (section "02 / Location & tags" of the book form), L2S5Lp (location and tags on book details),
ceW00/zKGk3 (My books: Advanced filters button, applied-filter chips, "6 of 842 books", no-result state), yUD6M
(Collections: Advanced filters button).

## Scope

In: bookcases and shelves (create, rename, move shelf, delete with affected-book count, empty ones kept); shelf
assignment in the book form; tags (create inline from the book form or from the Tags page, rename, delete with
affected-book count, unused tags kept); location and tags on book details and in the book audit; advanced filters for
My books and the Collections list (category, authors, collection, location, ownership, own reading status, tags
include/exclude, No location / No collection), combined with simple search and sorting; EN/FR; audit.
Out: inline location creation from the book form (docs: not initially), clickable bookcase visualisation, tag merging,
Overview counters (Task 8), sorting changes (already done in Tasks 2-3).

## Decisions (technical, within the specs)

- **Two new features**, `locations` and `tags`, each owning its tables, pages and endpoints (same reasoning as
  collections: own identities, pages and lifecycle; authors stay in `books`).
- **Persistence**: migration `008-locations-and-tags`, UUID ids with the migration-006 CHECK:
  - `bookcases` (`id`, `name`, `name_key` unique, timestamps);
  - `shelves` (`id`, `bookcase_id` FK cascade, `name`, `name_key`, unique `(bookcase_id, name_key)`, timestamps);
  - `book_shelves` (`book_id` PK, FK cascade; `shelf_id` FK cascade, indexed): at most one shelf per book;
  - `tags` (`id`, `name`, `name_key` unique, timestamps);
  - `book_tags` (`book_id`, `tag_id`, PK both, FK cascades, index on `tag_id`).
  Link tables are written only by their owning feature, as with `collection_books`. Deleting a shelf or bookcase
  cascades to its assignments (books kept); deleting a book cascades its links. Names: 1-100 characters, compared with
  `NameKey` (case, accents, outer spaces), labels kept as typed.
- **Book ports** (declared by `books`, implemented by the features, wired at the root like collections):
  - `ShelfAssignment.assign(bookId, shelfId | null)` → the book's location (`shelf-missing` for an unknown shelf);
  - `TagAssignment.assign(bookId, choices)` with `choices: ({ id } | { name })[]`: an equivalent name reuses the tag,
    a new name creates it and returns a `tag.created` related change for the book operation's audit;
  - readers `BookLocationReader.of(bookId)` and `BookTagReader.of(bookId)` for views and audit snapshots.
  Book input gains `shelfId: string | null` and `tags: TagChoice[]`; book view gains
  `location: { bookcaseId, bookcaseName, shelfId, shelfName } | null` and `tags: { id, name }[]`.
- **Advanced filters**: one `BookFilter` value in `books` application (categories, authorIds, collections (ids and/or
  `none`), locations (bookcase ids, shelf ids and/or `none`), ownerships, reading (`read`/`unread`), tags include and
  exclude). The Kysely catalog builds one per-book expression from the search text and the filter: different fields
  AND, choices within a field OR, every included tag present, no excluded tag. `CollectionBookSearch` takes the same
  search + filter, so a collection matches only when one of its books satisfies the whole expression (example 11);
  collection counts stay whole-collection (example 12). Guests: a reading filter is refused (`400
  reading-filter-unavailable`); their filter page has no such field.
- **API**:
  - `GET /api/books` and `GET /api/collections` gain repeatable query parameters `category`, `author`, `collection`
    (`<id>` or `none`), `location` (`bookcase:<id>`, `shelf:<id>` or `none`), `ownership`, `reading`, `tag`
    (include), `notTag` (exclude). Unknown ids simply match nothing.
  - `GET /api/bookcases` (bookcases with shelves and book counts, name order); `POST /api/bookcases`;
    `PATCH /api/bookcases/:id` (rename); `DELETE /api/bookcases/:id`; `POST /api/bookcases/:id/shelves`;
    `PATCH /api/shelves/:id` (`name` and/or `bookcaseId` to move); `DELETE /api/shelves/:id`.
    Conflicts: `bookcase-name-taken`, `shelf-name-taken` (also when moving).
  - `GET /api/tags?search` (with book counts); `POST /api/tags`; `PATCH /api/tags/:id`; `DELETE /api/tags/:id`.
    Conflict: `tag-name-taken`. Creating an equivalent existing tag from the Tags page is refused with the same
    reason (reuse is a book-form behaviour).
  - Filter options reuse the existing endpoints: authors search, collection names, bookcases, tags.
- **Permissions**: everyone signed in reads; Owners/Admin manage locations, tags and assignments
  (`requireLibraryEditor`). Guests see Bookshelves and Tags read-only (nav items stay, as in FFPyb).
- **Audit** (shared, Activity-eligible): `bookcase.created|renamed|deleted`, `shelf.created|renamed|moved|deleted`,
  `tag.created|renamed|deleted`; deletion snapshots carry the affected-book count. Book snapshots gain `location`
  (`shelfId`, labels) and `tags` (`id`, `name`); a tag created from the book form is a related `tag.created` record of
  the book operation (mechanism from the Task 3 follow-up).
- **Interface**:
  - **Bookshelves** page (ZRBZB): search, "3 bookcases · 9 shelves", hierarchy panel (bookcase name, shelf count,
    shelf rows "Shelf 3 · 64 books"), selected shelf (URL `?shelf=`) with its books (paged list via the books filter
    `location=shelf:<id>`) and Rename / Move shelf / Delete shelf, bookcase card with Add shelf / Rename bookcase /
    Delete bookcase and the "never deletes the books" note. Empty state g7I2l. Dialogs: New bookcase, Rename
    (bookcase/shelf), Create shelf and Move shelf (ty6Jg layout; the "Unassigned" bookcase option is not offered),
    Delete shelf (q84uEO), Delete bookcase (same pattern, also says its shelves are removed: not designed).
  - **Tags** page (R60eQ2): search, rows with name, "86 books", Rename, Delete; Create tag dialog; Delete tag dialog
    (y41k8); empty state in the same style as Bookshelves (not designed).
  - **Book form**: section "02 / Location & tags · Optional": Bookcase and Shelf selects (shelf required once a
    bookcase is chosen, helper "Books are assigned to a shelf, never a bookcase alone."), tag chip input "Find or
    create tag" with suggestions; an equivalent typed name selects the existing tag.
  - **Book details**: inline "Location and tags" editor (L2S5Lp) for Owners/Admin, saved automatically on each change
    (shelf chosen, tag added or removed) through `PATCH /api/books/:id/organisation` (`book.organised` audit), with a
    discreet saved/failed status instead of the Save button; Guests see the location and tag chips read-only.
  - **Advanced filters** page (q2GzCK / FFPyb) at `/books/filters` and `/collections/filters`, state carried in the
    URL query: Category, Authors, Collection (hidden for the Collections list), Location, Ownership, Your reading
    status (not for Guests) as multi-choice dropdowns including "No collection" / "No physical location"; tags block
    with search, All/Selected tabs, None/Include/Exclude per tag, summary chips with "+N more", Reset tags; "Show
    results" and "Clear filters". My books and Collections show removable applied-filter chips and "6 of 842 books";
    the no-result state offers "Clear filters" (zKGk3).

## Steps

1. [x] Domain: Bookcase, Shelf (rename, move), Tag entities and name rules; `BookFilter` value; unit tests.
2. [x] Persistence: migration 008 + SQLite tests (constraints, cascades, unique scopes, upgrade of a populated
       database); repositories; catalog filter expression and collection matching, with adapter tests for examples
       8-12 and 14.
3. [x] Application: locations and tags use cases (list, create, rename, move, delete with counts); assignment
       services and book ports; create/update/delete book integration; book views and audit snapshots; unit tests.
4. [x] HTTP: bookcases, shelves, tags controllers; list query schemas with filters; API e2e tests for every endpoint,
       roles, conflicts, audit.
5. [x] Libris: Bookshelves and Tags pages with dialogs, book form section 02, book details, advanced filters page,
       chips and counts on My books and Collections; EN/FR; component tests.
6. [x] Browser e2e: acceptance journeys (locations lifecycle, move, delete keeps books, tag reuse/rename/delete,
       combined filters on books and collections, Guest view without reading filter).
7. [ ] Docs (done), full check (done), architecture review (done, findings applied); remaining: commit,
       plan status. Docs (architecture: new features and ports, migration 008), full check, architecture review, commit, plan
       status.

## Decisions confirmed by the user (2026-11-05)

1. Plan approved.
2. Build the book details inline editor now, without a Save button: each change saves automatically.

## Implementation changes (vs. the plan)

- `book_shelves` is keyed by `(book_id, shelf_id)` with a unique index on `book_id` (like `collection_books`): the UUID
  primary-key rule requires single-column primary keys to be UUID `id`s.
- Books ports: writers `ShelfAssignment`, `TagAssignment`; readers `BookLocationReader`, `BookTagReader` (split after
  the architecture review, ISP). `BookOrganiser` applies changes; `BookOrganisationReader` serves the viewer, deletion
  and audit snapshots. One feature service implements both ports of a pair.
- `BookFilter` is a shared application value (`shared/application/book-filter.ts`) with `isEmpty()`, `usesReading()`
  and `readerFor(actor)` (refuses a Guest's reading filter with `reading-filter-unavailable`). Query parameters:
  `book-filter-query.ts` (schema) and `book-filter-query.mapper.ts` (ids compared in lowercase).
- `ListCollectionsUseCase.execute` takes the actor (reading filter). `GET /api/collections` also accepts `collection`;
  the web hides that field there.
- Book deletion removes shelf and tag links through database cascades (no port call).
- `PATCH /api/books/:id/organisation` (`book.organised`) backs the auto-saved inline editor (user decision 2); a refused
  change returns the editor to the last state the server confirmed.
- `GET /api/authors/by-id?id=` names chosen authors; collection chips use `GET /api/collections/:id`. Filter chips of a
  shared or bookmarked address are therefore named from the API (no browser storage).
- Filter page: the design's informational "Available ordering" block is left out (sorting stays on the list pages).
- Book details: the Location and tags editor is a panel under the book information rather than a right-hand column.
- Move shelf reuses the Create shelf layout (bookcase select and name), without the design's "Unassigned" option, and
  may rename and move at once. Undesigned: New/Rename bookcase dialogs, Delete bookcase confirmation, empty Tags page
  follow existing patterns.
- Audit categories: `bookcase.created|renamed|deleted`, `shelf.created|renamed|moved|deleted`,
  `tag.created|renamed|deleted` (deletions record unassigned/untagged book counts), `book.organised`; book snapshots
  carry `location` and `tags`; a tag created from a book save is a related `tag.created` record of that operation.

## Deferred review points (second architecture review, optional)

- `OrganiseBook` reads the current organisation twice for a partial request (for `before`, then inside
  `BookOrganiser.apply`) and records `book.organised` even when nothing changed; pass `before` in or skip no-ops.
- `ChangeShelf` records only `shelf.moved` when one request both renames and moves a shelf (before/after show both).
- `BookFilter` lives at the root of `shared/application/` but carries a rule (`readerFor`); it may belong under
  `shared/domain/value-objects/` later.
- The API spec helpers `shelfIn`/`tag`/`bookcase` are repeated across four e2e files; a fixture in
  `tests/api/fixtures` would remove the duplication.

## Notes for later tasks

- Overview counters (Task 8): bookcases and shelves from `GET /api/bookcases` (each with `shelves` and `bookCount`).
- Activity (Task 8): eligible categories above plus `book.organised`; `shelf.moved` before/after carry the bookcase
  names; a `tag.created` related record shares the book operation's ID.
- Leaf (Task 7) can reuse `BookFilter` query parameters on `GET /api/collections` if shopping needs narrowing.
- Lending (Task 5) leaves location and tags unchanged (features.md).
