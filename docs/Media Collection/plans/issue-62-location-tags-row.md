# Issue #62 — Location and tags side by side, one grouped Location selector

Status: **done** (2026-11-15). Decisions by the user on 2026-11-13 (GitHub issue #62), plan approved on 2026-11-15.
Branch `feat/book-location-tags-row`, one pull request. No Doop mock-up: the layout is specified in the issue.

Owning docs: [features](../product/features.md#physical-locations). No server or contract change: the requests,
access rules and saving behaviour are unchanged.

## Rules

- **One grouped Location selector** (`shared/book-form/shelf-select.tsx`), shared by the book page, the Libris add
  and edit form, the collection batch Shelf card, the Columns move dialog and Leaf add book:
  - one native select; each bookcase is a group heading that cannot be chosen, with its shelves underneath, each
    named "Bookcase – Shelf" so shelves of the same name stay apart;
  - bookcases without shelves are left out;
  - choosing a shelf also sets its bookcase in the draft; *Unassigned* clears both;
  - its hint and its error are tied to the field for screen readers.
- **Book page and Libris form:** Location and Tags side by side, Location in one third of the row and Tags in two
  thirds (the gap excluded), both top-aligned; extra tags make the row taller. The row stacks, Location first, when
  the panel is narrower than about 740 px (a wrapping row with starting widths of 240 px and 480 px); at the 1280 px
  minimum window the panel is about 920 px wide, so the two columns stay side by side. The book page saves at once
  and its saving/saved/error line spans the row below both columns; the form saves on *Save* only.
- **No shelf yet:** Libris keeps "No shelf exists yet." and its link to the Bookshelves page in the Location column;
  Leaf says "No shelf exists yet, so the book stays unassigned." with no desktop link.
- **Collection batch Shelf card:** one selector across the card, in required mode: a disabled "Choose a shelf" first
  line instead of *Unassigned*. *Place on a shelf* and *Fill if empty* need a real shelf ("Choose a shelf, or choose
  Clear." otherwise); *Clear* hides the selector and removes the location. Review and apply are unchanged.
- **Leaf add book:** the same selector, in the existing vertical layout; the remembered location of the last saved
  book is kept, and dropped when its shelf has been deleted since.
- **Guests:** unchanged (read-only summary on the book page).

## Acceptance examples

1. Book page at 1440 px: Location 353 px wide, Tags 707 px wide, both starting at the same height.
2. The selector of a library with bookcases *Oak* (Top, Bottom), *Study* (Top) and *Hall* (no shelf): *Unassigned*,
   then the *Oak* group with "Oak – Top" and "Oak – Bottom", then the *Study* group with "Study – Top"; no *Hall*.
3. In the add form, choosing "Study – Top" sends nothing until *Save*; the saved book is on Study – Top.
4. A book with 12 long tags at 1280 px: every remove button stays inside the Tags column.
5. Batch Shelf card, *Place on a shelf*, no shelf chosen, *Review changes*: "Choose a shelf, or choose Clear.", no
   request. *Fill if empty* with "Study – Top": `{ shelfId: 'study-top', onlyIfEmpty: ['shelfId'] }`. *Clear*: the
   selector disappears and `{ shelfId: null }` is sent.
6. Leaf, remembered shelf "Salon – Top": the selector starts on it; choosing "Study – Low" and saving sends that shelf.
