# Issue #76 — Bookshelves page: the Columns view

Status: **done** (2026-11-15). Decisions by the user on 2026-11-13 (GitHub issue #76), plan approved on 2026-11-15.
Branch `feat/bookshelves-columns-view`, one pull request. Design: Doop frame "Bookshelves · Columns view" (ready for
dev). Study: [bookshelves page proposals](../design/bookshelves-page-proposals.md), proposal D. Builds on
[issue 51](issue-51-bookshelves-wall.md) and [issue 75](issue-75-bookshelves-ribbons.md).

Owning docs: [features](../product/features.md#physical-locations). Libris page: `apps/web/src/libris/locations/`.
No server change: the table uses `GET /api/books?location=shelf:<id>&sort=shelf` with `offset` and `limit`, and a
move uses `PATCH /api/books/:id/organisation` with `{ shelfId }`, as the book page does.

## Rules

- **View choice:** *Wall*, *Ribbons*, *Columns*. Switching keeps the bookcase and the shelf of the address.
- **One panel, three columns:**
  - **Bookcases,** each with its book count, *New bookcase* at the foot.
  - **Shelves** of the selected bookcase, each with its book count; the header holds the bookcase name, its shelf
    count and a menu with *Rename bookcase* and *Delete bookcase*; *Add shelf* at the foot.
  - **Books** of the selected shelf: its name, "N books", *Rename*, *Move shelf*, *Delete shelf*, then a table.
- **The table:** a colour mark (the colour of the book's spine on the Wall), *Title*, *Author*, *Collection* ("Name ·
  2", "Name · 1–3", or "None"), *Status* (the ownership, then "Read" when the signed-in person has read it; "Lent to
  Name" in place of both). Shelf order of #51. The table scrolls inside the panel and loads the following books as it
  scrolls, 24 rows ahead of the last one in view. The footer shows the rows in view ("1–21 of 64") and the keys.
- **Keyboard:** the two first columns are single-choice lists: Up, Down, Home and End move the selection, and the
  next column follows. Left and Right go from column to column. In the table, Up and Down move between rows, Enter
  opens the book, M moves it.
- **Moving a book:** *M* on a row, or its *Move* button (shown on the pointed or focused row), opens a dialog named
  after the book, starting from its shelf. Choosing another shelf and *Move book* sends the change; the book leaves
  the table, the counts are reloaded and a message says where it went ("“Solaris” is now on Oak bookcase / Shelf 1.").
  A refused move shows its error in the dialog and keeps the book. Moving from the Wall or the Ribbons is not part of
  this issue.
- **Selection in the address:** `?bookcase=` and `?shelf=`, as in the other views.
- **Empty cases:** an empty shelf says "No book is on this shelf yet."; a bookcase without shelves shows only *Add
  shelf* and an invitation in the books column.
- **Guests** see everything without the action buttons, the menus and the move.
- **Narrow window:** not applicable. Libris keeps a 1280 x 720 minimum, so the issue's rules under about 1000 px (no
  *Collection* column) and 800 px (bookcases as a drop-down) never apply.
- Shared pieces: the shelf book loader `use-shelf-books.ts` (also used by the Ribbons), the move dialog
  `move-book-dialog.tsx`, the row height in `columns-sizes.ts`.

## Acceptance examples

1. `/bookshelves?view=columns&shelf=s3`: the bookcases list selects *Oak bookcase*, the shelves list selects
   *Shelf 3*, and the table "Books on Shelf 3" shows its books.
2. *Wolf Hall* by Hilary Mantel, volume 1 of *Thomas Cromwell*, owned and read: "Wolf Hall · Hilary Mantel · Thomas
   Cromwell · 1 · Owned · Read". *Snow Crash* lent to Camille: "Lent to Camille".
3. Focus *Oak bookcase* and press Down: *Study bookcase* is selected, the address becomes `?view=columns&bookcase=study`
   and its first shelf is shown.
4. Focus *Oak bookcase*, press Right twice, then Enter: the first book of the shelf opens.
5. A shelf of 40 books: the footer starts at "1–N of 40"; scrolling to the bottom loads the others and shows
   "…–40 of 40".
6. Focus *Solaris*, press M, choose *Shelf 1*, *Move book*: "“Solaris” is now on Oak bookcase / Shelf 1.", the row
   leaves the table and *Shelf 1* counts one more book.
7. A Guest presses M on a row: nothing opens; there is no *Move* button, no *Add shelf* and no bookcase menu.
