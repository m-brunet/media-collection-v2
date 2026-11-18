# Issue #51 — Bookshelves page: three views with a switch, and the Wall view

Status: **done** (2026-11-15). Decisions by the user on 2026-11-13 (GitHub issue #51), plan approved on 2026-11-15.
Branch `feat/bookshelves-wall-view`, one pull request. Design: Doop frames "Bookshelves · Wall view (issue 51)", empty
shelf, bookcase without shelves and Guest (ready for dev). Study: [bookshelves page proposals](../design/bookshelves-page-proposals.md).
Follow-ups: Ribbons view (#75) and Columns view (#76), each adding a view beside the Wall.

Owning docs: [features](../product/features.md#physical-locations). Server: `apps/server/src/locations` (spines of a
bookcase) and `apps/server/src/books` (shelf order of the book list). Libris page: `apps/web/src/libris/locations/`.

## Rules

- **Page shell:** the title, "N bookcases · N shelves · N books" under it, the View choice, *New bookcase*. The search
  field, the bookcase tree and the 24-at-a-time book list are gone; finding a book stays in the Library.
- **View choice:** shared with the Statistics page (`shared/ui/view-choice.tsx`). The view is kept in the address
  (`?view=`) and remembered in the browser; an unknown or missing view falls back to the remembered one, then to Wall.
  **It is hidden while the page has a single view**, so it appears with #75 or #76. Selecting a bookcase or a shelf
  keeps the view in the address.
- **Selection in the address:** `?bookcase=` and `?shelf=`. Without them, the first bookcase and its first shelf.
  When both are given and the shelf stands in another bookcase, the bookcase wins and its first shelf is selected
  (changed on 2026-11-15 with #75, whose tabs change the bookcase and keep the shelf).
  Opening a bookcase from the strip selects its first shelf.
- **Strip:** one miniature per bookcase, in the bookcase list order (by name). One bar per shelf, as long as its book
  count compared to the fullest shelf of the library. The open bookcase is marked; the strip scrolls sideways when it
  does not fit. A Small bookcase's miniature is half as wide as a Large one's; its tile keeps room for the name
  (issue #142).
- **Open bookcase:** name, "N shelves · M books", the **Width** choice (*Large* / *Small*), *Add shelf*, *Rename
  bookcase*, *Delete bookcase*; then one bay per shelf with its name and book count on the left. The name or the bay
  selects the shelf. Choosing a width saves it on the bookcase at once and redraws it; a failed save puts the choice
  back and shows the error (issue #142). On a Small bookcase the header wraps on up to three lines.
- **Spines** (`spine-layout.util.ts`, sizes in `wall-sizes.ts`):
  - one spine per book, in **shelf order**: the books of a collection together, in volume order, standing where the
    collection's name falls among the titles; a book in no collection stands at its title;
  - width from the page count, 6 px to 22 px at 900 pages and more;
  - a book without a page count is drawn as an average book of its category (book 400, manga 200, comic 70 pages).
    When the shelf overflows, these books shrink by the same amount, never under 6 px; books with a page count keep
    their width;
  - the books that still do not fit go behind, faded; beyond two layers nothing is drawn and the count stays exact;
  - colour and height come from the book's identifier. A spine is 50 px to 68 px tall, so it never reaches the shelf
    above, even behind (lowered from 56–78 px on 2026-11-15: the tallest spines touched the board). The 8 spine colours are fixed book colours, the same on every
    appearance colour scheme (changed on 2026-11-15: colours mixed from the scheme accent changed the look of a shelf
    with the scheme and blended with the selected-shelf outline).
- **Spines and the keyboard:** each spine is a link named "Title · Author" that opens the book; pointing at it or
  focusing it shows the same text. A shelf is one Tab stop; the arrow keys, Home and End move between its spines.
- **Shelf panel:** "Bookcase / Shelf", "N books on Shelf", then two rows of covers in shelf order. When the books do not
  fit, the last place is a "+N more" tile. The tile and *Open this shelf in the Library* open the Library filtered on
  the shelf (`/books?location=shelf:<id>`). A lent book carries a "Lent" band. Then *Rename*, *Move shelf*,
  *Delete shelf*.
- **A drawing of fixed size:** a bay is 420 px wide on a **Large** bookcase and 210 px on a **Small** one, on every
  window (issue #142, 2026-11-18; 570 px for every bookcase before). The size is saved on the bookcase, the same for
  every account; existing and new bookcases are Large. The rule for books that do not fit applies to the bookcase's
  width: at 210 px a shelf holds about 45 books before some are not drawn. A wide window, or a Small bookcase, gives
  its extra room to the shelf
  panel (more covers per row, still two rows, up to 640 px). Under 1100 px the panel moves below the bookcase. When
  the bookcase column is narrower than the drawing (for example at the 1280 px minimum window), the whole drawing
  shrinks as one picture.
- **Empty cases:** an empty shelf has an empty bay and the panel says it has no book; a bookcase without shelves shows
  its header and an invitation to add one; no bookcase: the empty state of before.
- **Guests** see everything without the action buttons, and each bookcase at its saved width without the Width
  choice.
- The sizes (bay width, spine widths, average pages) are starting values, to be judged on the real library.

## API

- `GET /api/bookcases/:id/spines` (signed in, any role, Guests included): `BookcaseSpinesDto` with `bookcaseId` and
  `shelves[]` (shelves ordered by name, empty ones included), each with `shelfId` and `books[]` (`id`, `title`,
  `authors`, `category`, `pageCount` or `null`) in shelf order. An unknown bookcase gives `404` (`bookcase-missing`).
  Nothing is stored.
- `PATCH /api/bookcases/:id` takes an optional `name` and an optional `size` (`large` | `small`), at least one of
  them (Owners and Admin). `BookcaseDto.size` gives the saved size. A size change alone is audited as
  `bookcase.resized`, which Activity does not show; a name change stays `bookcase.renamed` (issue #142).
- `GET /api/books?sort=shelf`: the shelf order above, used by the shelf panel (`limit=16`) and later by #75 and #76.

## Acceptance examples

1. A library of 3 bookcases, 3 shelves and 66 books: the title line reads "3 bookcases · 3 shelves · 66 books".
2. `/bookshelves` with no selection opens the first bookcase and its first shelf. Clicking *Study bookcase* in the
   strip opens it with its first shelf selected and the address becomes `?bookcase=study`.
3. On *Shelf 3*, *Dune* by Frank Herbert (612 pages) is drawn 17 px wide and named "Dune · Frank Herbert"; it links to
   its book page. A manga without a page count is drawn 10 px wide.
4. A shelf of *Saga 2*, *Zeta*, *Alpha*, *Saga 1* (the two Saga books in the collection *Saga*) is drawn Alpha, Saga 1,
   Saga 2, Zeta.
5. A shelf of 10 books of 450 pages in a 30 px wide bay: two books in front, two behind, six not drawn; its count
   still says 10 books.
6. Focus the first spine of a shelf, press the Right arrow twice: the third spine has the focus; Tab leaves the shelf.
7. A shelf of 64 books at 1440 px: 9 covers and a "+55 more" tile; the tile opens the Library on that shelf. A shelf
   of 10 books: the 10 covers, no tile.
8. The window grows from 1440 px to 1920 px: the bays keep their width and the shelf panel grows.
11. A Large bookcase has bays 420 px wide; a shelf with 400 px of spines shows one row. Choosing *Small* redraws it at
    210 px and the same shelf shows two rows; a reload, or another account, still shows it Small (issue #142).
9. A Guest sees no *New bookcase*, *Add shelf*, *Delete bookcase*, *Move shelf* or *Delete shelf*.
10. `/bookshelves?view=unknown` shows the Wall; the View choice is not shown while the Wall is the only view. (Since #75
    the choice shows Wall and Ribbons.)
