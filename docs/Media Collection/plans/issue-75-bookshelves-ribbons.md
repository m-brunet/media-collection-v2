# Issue #75 — Bookshelves page: the Ribbons view

Status: **done** (2026-11-15). Decisions by the user on 2026-11-13 (GitHub issue #75), plan approved on 2026-11-15.
Branch `feat/bookshelves-ribbons-view`, one pull request. Design: Doop frame "Bookshelves · Ribbons view" (ready for
dev). Study: [bookshelves page proposals](../design/bookshelves-page-proposals.md), proposal B. Builds on
[issue 51](issue-51-bookshelves-wall.md) (page shell, View choice, shelf order).

Owning docs: [features](../product/features.md#physical-locations). Libris page: `apps/web/src/libris/locations/`.
No server change: the strips use `GET /api/books?location=shelf:<id>&sort=shelf` with `offset` and `limit`.

## Rules

- **View choice:** *Wall* and *Ribbons*. With two views the choice is shown on the title line. Switching keeps the
  bookcase and the shelf of the address.
- **Bookcase tabs:** one tab per bookcase, in the bookcase list order, with its name and "N shelves · M books". The
  open bookcase is the `bookcase` of the address (the first one without it). The tabs are a tab list: the Left and
  Right arrows, Home and End move to another bookcase and open it. The row scrolls sideways when it does not fit.
- **The address:** opening a bookcase from a tab writes `?bookcase=` and leaves `?shelf=` untouched, so the Wall finds
  the same shelf again. The bookcase of the address wins: a `shelf` of another bookcase is ignored, and the Wall then
  selects the first shelf of the open bookcase.
- **Open bookcase:** its name, "N shelves, top to bottom", *Add shelf*, *Rename bookcase*, *Delete bookcase*. There is
  no selected shelf in this view.
- **One strip per shelf,** top to bottom. On the left, the shelf name, which opens My books filtered on the shelf, the
  book count, and a "more" button whose menu holds *Rename*, *Move shelf* and *Delete shelf*. Then the covers in
  shelf order, one cover high.
- **Covers per strip:** as many as the width allows (58 px covers, 8 px apart; 13 at 1440 px, more on a wider window).
  When the books do not fit, the last place is a "+N" tile counting the books after it.
- **Moving along a shelf:** the next arrow and the "+N" tile show the following covers. Once the strip has moved, a
  back arrow appears at its start, in the place of one cover, and goes back to the previous covers.
- **Loading:** a strip loads its first books when it comes into view, 24 at a time, and the next ones as it moves.
  Each strip has its own loading and error state.
- **A cover** is a link named "Title · Author" that opens the book. Pointing at it or focusing it shows a card with
  the title, the author and the status line of My books ("Owned · Read · Lent"; Guests have no reading status). A lent
  book carries a "Lent" band.
- **Empty cases:** an empty shelf says "No book is on this shelf yet."; a bookcase without shelves invites to add one.
- **Guests** see everything without the action buttons and menus.
- **Narrow window:** not applicable. Libris has a 1280 x 720 minimum (the Electron window cannot be smaller, and in a
  browser the page keeps 1280 px and scrolls sideways), so the "shelf name above its strip under 900 px" rule of the
  issue never applies.
- The sizes are in `ribbon-sizes.ts`, the strip arithmetic in `ribbon-window.util.ts`.

## Acceptance examples

1. A library of 3 bookcases: the tab list shows the 3 bookcases, the open one selected, each with "N shelves · M books".
2. `/bookshelves?view=ribbons&shelf=s3`, then the *Study bookcase* tab: the address becomes
   `?view=ribbons&bookcase=study&shelf=s3`. Switching to the Wall shows *Study bookcase* with its first shelf.
3. Focus the *Oak bookcase* tab and press the Right arrow: *Study bookcase* opens and its tab has the focus.
4. A shelf of 20 books at 1440 px: 13 covers and a "+7" tile; at 1920 px, more than 13 covers.
5. Press the next arrow of that shelf: the covers from the 14th book are shown with a back arrow; the back arrow shows
   the first covers again.
6. A shelf of 2 books: the 2 covers, no tile, no arrow.
7. Pointing at *Dune* by Frank Herbert, owned and not read, shows "Dune" and "Frank Herbert · Owned · Not read".
8. The *Shelf 3 actions* menu, then *Move shelf*: the "Move Shelf 3" dialog opens.
9. A Guest sees no *New bookcase*, *Add shelf* or shelf actions menu.
