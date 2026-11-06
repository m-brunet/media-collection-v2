# Task 2 — Books (core library)

Status: in progress (started 2026-11-04). Global plan: [implementation plan](implementation-plan.md).
Owning docs: [features](../product/features.md) (Books, Lists/search/sorting), [book-entry](../product/book-entry.md) (manual entry, ISBN, authors, dates, price, notes; lookup is Task 6), [collection-editions-impact](../product/collection-editions-impact.md), [locations-tags-search](../product/locations-tags-search.md) (simple search and sorting part).
Design: `design/artifact/screens/` ceW00 (My books), L2S5Lp/v9MipE/gRcO9 (details), tr7ll/FOZxg (add/edit), I6aLY5 (no-ISBN duplicate), dp3g6 (author correction), U5T73Q (discard), WvaIi/zKGk3/BUKLy (empty, no results, loading).

## Scope

In: book records with all fields except collection membership (Task 3), location and tags (Task 4), loans (Task 5) and lookup (Task 6); shared authors; covers (manual upload); personal reading status and private note; My books list with simple search, sorting and paging; details; add/edit/delete; Activity-eligible audit records.
Out (later tasks fill them in): collection controls in section 1, the whole section 2 (location & tags), "Find book", lending indicators, advanced filters.

## Decisions (technical, within the specs)

- **Feature `books`** owns books and authors (authors are shared identities used only by books). A shared pure helper `NameKey` implements the user's comparison expression (`normalize('NFD')`, strip marks, `toLocaleLowerCase`, `trim`); collections, tags and receivers reuse it later.
- **Similar names** (authors; no-ISBN duplicate titles): equal keys reuse the identity. "Similar" = Damerau-Levenshtein distance ≤ 1 for keys up to 8 characters, ≤ 2 above, or one key containing the other as a whole word sequence. Similarity only ever asks; it never merges.
- **Asking the user**: a similar author or a possible no-ISBN duplicate rejects the save with `conflict` + reason (`author-similar`, `possible-duplicate`) and the candidates in a new `details` field of the error body; the form shows the choice and resubmits with the user's answer (`existing author id`, or `distinct: true`). `Failure` gains optional `details`.
- **ISBN**: input may contain spaces/hyphens; ISBN-10 (with X) and ISBN-13 checksums validated; ISBN-10 converted to ISBN-13; stored ISBN-13 plus a `converted from ISBN-10` flag shown on details. Unique ISBN-13 (database index). No-ISBN is an explicit flag; then ISBN must be empty.
- **Values**: category `books|manga|comics` (default books); ownership `owned|not-owned` (default owned); publication date year (1–9999) with optional month, no day; price stored in cents, null = unknown, 0 = free, input accepts comma or dot, ≤ 2 decimals; page count positive integer or null; title ≤ 300, summary ≤ 5000, publisher ≤ 200, note ≤ 5000 characters.
- **Authors**: at least one per book, kept in order. Removing the last link of an author deletes the author (also on book deletion). Correcting an author's spelling (`PATCH /api/authors/:id`) changes it everywhere, with confirmation in the UI; a correction to a name equivalent to another author is refused (`author-name-taken`). Explicit author deletion has no interface in the specs ("no dedicated author-management interface"), so it is not built now.
- **Covers**: JPEG, PNG or WebP up to 10 MB, checked by file signature; stored under `<data>/covers/` with a random name; uploaded/replaced/removed on their own endpoints after the book is saved; served to every signed-in account; missing cover shows a neutral fallback.
- **Personal data**: `reading_statuses` (absent row = Not read, so new accounts and new books start Not read) and `personal_notes` (one per user and book). Only the author's own note is ever returned; Guests get neither field and cannot call these endpoints. Audit records for notes never contain the text (only whether a note exists).
- **Audit categories**: `book.created`, `book.updated`, `book.deleted`, `book.cover-changed`, `author.corrected` (shared, Activity-eligible later); `book.reading-status-changed`, `book.note-changed` (personal, never in Activity).
- **List**: server-side search (case/accent-insensitive partial on title and author names via stored keys; ISBN digits partial, a valid ISBN-10 also matches its ISBN-13), sort title / date added / publication date in either direction (missing publication dates last both ways), paging 48 per page with "Load more". Default title A–Z.
- **Permissions**: Owners/Admin create, edit, delete and upload covers (`requireLibraryEditor`); every signed-in account reads.
- **Interface**: Libris switches to a data router (`createBrowserRouter`) so unsaved-changes confirmation also covers sidebar navigation. My books opens the details page on selection (the design's side panel becomes the details route, as the design guidelines allow). "My books" becomes the landing page.

## Steps

1. [x] Shared: `NameKey`/similarity helper, `Failure.details`, HTTP error body.
2. [x] Domain: value objects (Isbn, PublicationDate, Price, PageCount, BookCategory, Ownership), entities Book and Author, with unit tests.
3. [x] Persistence: migration 005 (authors, books, book_authors, reading_statuses, personal_notes), repositories, list query, cover file storage; SQLite tests.
4. [x] Use cases: create/update/delete/get/list books, author resolution and correction, search authors, cover replace/remove/read, reading status, personal note save/delete; unit tests.
5. [x] HTTP: books, authors and cover endpoints (raw image body), API tests for every endpoint.
6. [x] Libris: data router, My books (grid, search, sort, load more, empty/no-result/loading), details (reading, note, delete), add/edit form (three sections minus later parts, author picker, similar-author and duplicate dialogs, author correction, cover, additional info, discard confirmation, save failure), EN/FR; component tests.
7. [x] Browser e2e journeys: add a book with ISBN-10, details shows conversion; no-ISBN duplicate warning; Guest read-only; reading/note privacy between two Owners; search and sort.
8. [x] Docs, full check, architecture review, commit, plan status.

## Notes for later tasks

- Persistence is covered by the controller e2e tests on real SQLite plus `file-cover-storage.adapter.spec.ts`; the
  read-side list query lives in `kysely-book-catalog.adapter.ts` (the architecture lint requires `.adapter.ts` for
  non-repository adapters).
- Cover uploads send the image as the raw body (`image/*` or `application/octet-stream`). `HttpApplication.uploadPaths`
  lists the raw-body routes; the composition root passes it to `HttpSessions`, whose CSRF check accepts those types only
  there. Bodies above ~10 MB get 413 with reason `cover-too-large`. The CSP allows `blob:` images for local previews.
- `tests/api/client.ts` can send raw bytes (`options.raw`) and exposes `bytes`; `ApiClient.request` takes `file`.
- `ApiError.details` carries failure data (`author-similar`: `{name, candidates}`; `possible-duplicate`: `{candidates}`;
  `isbn-taken`: `{bookId}`).
- Libris now uses a data router (`createBrowserRouter`), so `useBlocker` works; the book form uses it for the
  unsaved-changes dialog. Component tests render pages with `testing/render-route.test-support.tsx`.
- `/` lands on `/books` (My books). Sections 02 (location and tags) and collection membership of the book form are
  left for tasks 3 and 4; the form is built so those blocks slot in between the main and additional sections.
- Author search (`FindAuthors`) filters the author list in memory; fine for a household library, revisit if large.
- The global CSS rule `[hidden] { display: none !important; }` now guarantees `hidden` beats component display rules.
