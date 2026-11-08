# Development data commands — reset and V1 import

Status: done (2026-11-06), on `master`. Requested by the user after Task 5.5; see "Future development data
commands" in the [implementation plan](implementation-plan.md). Development tooling only: it adds no product feature
and no HTTP endpoint.

## Goal

Two npm commands that act **only on the development data directory** (`<repo>/.dev-data`), never on an installed
release's data:

- `npm run dev:reset-data`: delete the library and keep the accounts.
- `npm run dev:import-v1 -- local-imports/v1/books.json`: replace the library with the V1 (MongoDB) backup.

## Decisions (user, 2026-11-06)

- Run with the development app closed. A command refuses to run when the app is packaged, when the data directory is
  changed (`--data-dir`, `APP_DATA_DIR`), when `.dev-data` is a link or resolves elsewhere, and while the
  development app is running (Electron's single-instance lock, which follows the data directory's profile).
- Reset keeps users (accounts, passwords, roles, language, appearance) and the server settings. It deletes library
  data (books, authors, collections, bookcases/shelves, tags, receivers, loans, reading statuses, personal notes,
  cover files) and the audit log, and signs every session out. It deletes records; it never drops tables.
- Import = reset + import, in one transaction: a failure keeps the previous library.
- Code: a `development-data` backend feature started by dev-only Electron flags, like `--reset-admin`. It reuses the
  books and collections use cases through their driving ports; new books go through a books `ImportBook` use case
  that keeps the V1 creation date (updated date = migration time, audit records = Admin at migration time).
- Covers: downloaded once into `local-imports/v1/covers/` (Git-ignored), reused by later imports. Covers that fail
  to download or are not JPEG/PNG/WebP are skipped and reported.
- Categories: `local-imports/v1/category-corrections.json` (collection name → `books`/`manga`/`comics`) overrides
  V1 `type` for every book of that collection. An untitled book that is still a Book in a collection is saved with
  its collection title (`Name Vol. N`) as a supplied title and reported (user, 2026-11-06); an untitled book outside a
  collection stops the import.

## V1 mapping (agreed earlier)

`bought` true → Owned, false → Not Owned. `type` book/manga/comics → books/manga/comics. `read` READ → read by the
Admin, other values not read. `volume` → single-volume membership; volume 0 enables the collection's volume 0.
`authors`/`collectionName` → reused by name (equivalent names join; similar names are distinct). `created` → createdAt.
`pageCount` 0 → unknown. Blank title → generated title. `isbn-corrections.json` fills the missing ISBNs by record
number (title checked). `lastElement`: the highest marked volume is the last; the collection is Finished when every
volume up to it is present and Owned and none goes beyond, otherwise it stays unfinished and is reported. Ignored:
`_id`, `bookRate`, `customFields`, `__v`. No loans or receivers.

## Steps

- [x] 1. Development-only launch: flags, guard, worker messages, npm scripts; `ResetDevelopmentData` with the
  library eraser and cover cleanup; tests.
- [x] 2. Books `ImportBook` use case (V1 creation date) and its provider; tests.
- [x] 3. `ImportV1Library`: dump/corrections reader, V1 planner (mapping rules), cached cover downloads, composition;
  tests with a synthetic dump.
- [x] 4. Local inputs (dump copy, corrections), real run on `.dev-data`, docs and architecture review.

## Implementation notes (2026-11-06)

- Real run on `.dev-data`: 446 V1 records → 446 books in 91 collections, 437 covers; 18 collections set to Manga in
  `category-corrections.json`; 2 collections left unfinished (Doubt, Samurai Girl); 9 covers unusable or unavailable.
- The collection title of an untitled Book is built by books (`ImportBook`, through `GeneratedTitle`), which returns
  the saved title; the planner only checks that the book is in a collection.
- Cover cleanup asks the books `CoverStorage` (`list`, `remove`) which covers are stored, instead of knowing their
  folder and naming. The terminal output is a feature driving adapter (`DevelopmentDataReport`); root config only
  composes.
- Optional review suggestions, done at the user's request: identity finds the import administrator
  (`LibraryAdministratorLookup`, implementing the development-data `LibraryAdministrator` port through the identity
  `User` rules); `BOOKS_IMPORT` is registered only for the development commands (`developmentImport` option of
  `LibraryModules`/`BooksModule`), not in the HTTP backend; the downloads adapter fetches all covers, 8 at a time
  (`CoverDownloads.fetchAll`), so the import use case only asks for them.
- Task 9 (2026-11-08): the library eraser and the cover cleanup moved to the `maintenance` feature
  (`KyselyLibraryEraser`, `KyselyCoverFileCleanup`), shared with the Admin data reset; `npm run dev:reset-data` is
  composed with them, so both resets delete the same library tables.
