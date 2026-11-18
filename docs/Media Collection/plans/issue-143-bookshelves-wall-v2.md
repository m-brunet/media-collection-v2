# Issue #143 · Bookshelves Wall v2

Owning docs: [features](../product/features.md#physical-locations). Design: Doop frame
"Wall v2 · 1920 × 1080 · Claude's proposal: everything on one screen" (approved 2026-11-18). Depends on #142 (Large or
Small bookcases).

## Decisions (2026-11-18)

- **A fourth view**, *Wall v2* (FR *Mur v2*), after the Wall in the View choice, remembered like the others
  (`?view=wall-v2`). The Wall is unchanged; which of the two stays is decided later.
- **One screen:** from top to bottom, the page header, a **Go to** row, the line of bookcases and the shelf panel, which
  stays at the bottom of the window. The page does not scroll unless the window is too short for half-size bookcases.
- **The line:** every bookcase in its own panel, side by side, aligned at the bottom on a floor line. All bookcases share
  one scale, chosen so the bookcase with the most shelves fits the room between the Go to row and the shelf panel, never
  above full size and never under half size. The line never shows a scrollbar: what does not fit is cut at the right edge,
  and **Previous bookcases** / **Next bookcases** move it by one bookcase, disabled at their end and absent when
  everything fits.
- **Go to:** one button per bookcase; the bookcases in view are outlined, the one holding the selected shelf is in the
  accent colour; a click brings that bookcase to the left edge. Selecting a shelf, opening the page on a shelf or moving
  the focus into a bookcase that is cut brings its bookcase into view.
- **Bookcase header:** the name, **Edit bookcase** (a pen), and on the right **Add shelf** (+) and **Delete bookcase** (a
  bin); the counts under it. Icon buttons have a name and a tooltip. **Edit bookcase** asks the name and the Large / Small
  width in one dialog (`PATCH /bookcases/:id` with `name` and `size`). Guests see the name and the counts only.
- **Spines** are those of the Wall (same layout, back row rule, pointing and keyboard), loaded when a bookcase first
  comes into view.
- **Shelf panel:** the title, **Rename shelf** (a pen), the bookcase / shelf eyebrow, and on the right **Add books**,
  **Move shelf** and **Delete shelf** (a bin); then one line of covers filling the width, the last tile "+N more", and
  **Open this shelf in the Library**.
- **Sizes** (`wall-sizes.ts`): 16 px between bookcases, 21 px of padding and border on each side of a bookcase, 110 px for
  its header and padding, half size at least, 48 px kept under the shelf panel.

## Acceptance examples

1. At 1920 × 1080 with 8 bookcases of 4 to 7 shelves, the line and the whole shelf panel are on the screen; the page
   scrolls in neither direction.
2. **Next bookcases** brings the next bookcase to the left edge and is disabled once the last one is in view.
3. Clicking a shelf of another bookcase shows its covers in the panel and puts the accent border on its bookcase.
4. **Edit bookcase**, Small, Save: the bookcase is drawn half as wide on the line and in the Wall.
5. A Guest sees the bookcases and the covers, no button.
