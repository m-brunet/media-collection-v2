# Bookshelves page: design proposals

Status: refinement of [issue 51](https://github.com/m-brunet/media-collection-v2/issues/51) in progress. Four proposals are drawn; none is chosen yet. Nothing here is a requirement until a proposal is picked.

The proposals are drawn on the Doop canvas, page [Bookcases page - New designs](https://doop.design/c/shiKEeCX2V?page=v9usJgjHFw). They follow the Libris look described in [design guidelines](design-guidelines.md): they change the structure of the page, not its style.

## Context

Today the Bookshelves page (`apps/web/src/libris/locations/bookshelves-page.tsx`) has two parts:

- on the left, a list of bookcases, each one collapsible, with its shelves;
- on the right, the books of the selected shelf as a vertical list, one row per book (cover, title, ownership), 24 at a time behind a "load more" button, followed by the bookcase actions.

Issue 51 asks for a compact way to show a shelf's books: roughly one cover high, two at most, instead of a list that grows with every book.

The study was widened from the shelf's book list to the whole page, to compare really different ideas rather than variants of the same layout.

### Library used in the mock-ups

All four proposals show the same library, sized on the real one the page must handle:

- 8 bookcases with 5 to 7 shelves each, 49 shelves in total;
- 2,934 books, between 29 and 83 per shelf;
- the bookcase "Study · oak" and its "Shelf 3" (64 books) are selected in every frame.

## Decisions taken during the study

- **Front and back rows are out of scope.** A real shelf often holds two rows of books, one behind the other. The application does not record this and it is not planned. No proposal shows row counts, a front/back switch or a row level in the navigation.
- **Proposal A keeps books drawn in front of and behind each other, as decoration only.** The drawing is tied to no row data: the application decides which spines go behind when the front is full. It does not claim to know where a book really stands. This leaves the door open to real front/back rows later.
- **In proposal A the drawing follows the data.** The more books registered on a shelf, the more spines drawn. The rules are in [Spine drawing rules](#spine-drawing-rules).
- **The mock-ups are static.** Covers and spines in the frames are drawn placeholders with invented colours, not real cover art, and the spine widths there are random. The rules below describe the intended behaviour, not what the frames compute.

## Proposal A: Bookcase wall (most visual)

[Frame on Doop](https://doop.design/c/shiKEeCX2V?frame=55i8OSmaBa)

**Idea.** The page looks like the furniture. Bookcases are drawn as small pieces of furniture, and the open one is shown with its shelves and book spines.

**Layout.**

- A strip of the 8 bookcases across the top. Each is a miniature with one bar per shelf, longer when the shelf holds more books, plus its name, shelf count and book count.
- Below, the selected bookcase drawn large: one bay per shelf, top to bottom, filled with spines. The shelf name and book count sit to the left of each bay.
- To the right, a panel for the selected shelf: two rows of covers (9 covers and a "+55 more" tile), a link to open the shelf in My books, and the shelf actions (rename, move, delete).
- Bookcase actions (add shelf, rename, delete) are in the header of the drawn bookcase.

**Interactions.** Selecting a miniature opens that bookcase. Selecting a bay or its label selects the shelf. Pointing at a spine shows the book's title and author; clicking it opens the book.

**Strengths.** A shelf is recognised at a glance, the way it is in the room. The fill level of all 8 bookcases is visible without opening them. The shelf's books stay within two rows of covers, as the issue asks.

**Weaknesses.** Only one bookcase is shown in detail. It is the most work to build. Spines carry no text, so a book is found by pointing, not by reading.

**Data needed.** See [Spine drawing rules](#spine-drawing-rules): drawing one spine per real book needs every book of the open bookcase, with its page count, where the page loads only the selected shelf today.

## Proposal B: Shelf ribbons (covers first)

[Frame on Doop](https://doop.design/c/shiKEeCX2V?frame=iFAu2Nzq3b)

**Idea.** One bookcase at a time, shown as its covers. Each shelf is a horizontal strip of covers, one cover high.

**Layout.**

- The 8 bookcases as tabs across the top, each with its shelf and book counts.
- Below, the open bookcase: its name, its actions, then one strip per shelf, top to bottom.
- Each strip shows the shelf name and book count on the left, then 13 covers, a "+N" tile for the books that do not fit, and an arrow to move along the shelf.
- Shelf actions are behind a "more" button next to the shelf name.

**Interactions.** Selecting a tab changes bookcase. The arrow scrolls a strip. Pointing at a cover shows title, author, ownership and reading status; clicking it opens the book. A lent book carries a "Lent" band on its cover.

**Strengths.** About 80 covers of a bookcase are visible at once. It answers the issue directly: every shelf is one cover high. There is no selected shelf to manage; the whole bookcase is the view.

**Weaknesses.** Many covers are loaded at once, for every shelf of the bookcase. The other bookcases are only names and counts. A shelf with 70 books still shows 13 of them without scrolling.

**Data needed.** The first books of every shelf of the open bookcase, where the page loads one shelf today.

## Proposal C: Shelf map (everything at once)

[Frame on Doop](https://doop.design/c/shiKEeCX2V?frame=4dn1FpqB8h)

**Idea.** The whole library on one screen. A grid shows every shelf of every bookcase; the selected shelf's books appear in one strip below.

**Layout.**

- A grid with one column per bookcase and one cell per shelf, top to bottom as the shelves stand. A cell shows the shelf name and its book count, and is brighter when it holds more books.
- Column headers show the bookcase name, shelf count and book count.
- Where a bookcase has fewer shelves than the tallest one, a dashed cell with a plus adds a shelf.
- Below the grid, a tray for the selected shelf: its name and count, its actions, one strip of covers (9 covers and a "+55 more" tile), and a link to open the shelf in My books.

**Interactions.** Selecting a cell selects the shelf and fills the tray. Selecting a column header selects the bookcase.

**Strengths.** All 49 shelves are visible and one click away. It shows where there is room. It is the cheapest to build: the grid uses only the names and counts the page already receives, and the tray loads one shelf, as today.

**Weaknesses.** The least like a bookshelf: it is a table of numbers. Brightness compares shelves to each other, not to their capacity, which the application does not know. Bookcase actions are less visible than in the other proposals.

**Data needed.** Nothing new.

## Proposal D: Column browser (most compact)

[Frame on Doop](https://doop.design/c/shiKEeCX2V?frame=qeeCaeSIf6)

**Idea.** A file-browser layout built for the keyboard. No covers.

**Layout.**

- Three columns side by side in one panel: the bookcases with their book counts, the shelves of the selected bookcase with theirs, then the books of the selected shelf.
- The books are a dense table: a small colour swatch, title, author, collection and status (owned, read, lent to whom). 21 rows are visible; the table scrolls inside the panel.
- "New bookcase" and "Add shelf" sit at the foot of their columns. Shelf actions are in the header of the book table.
- A footer reminds the keyboard commands.

**Interactions.** Arrow keys move between columns and rows, Enter opens the book, a key moves it to another shelf.

**Strengths.** The most information per screen and the fastest for tidying or moving many books. It replaces "load more" with a list that scrolls in place.

**Weaknesses.** It gives up the visual side of the issue: no covers, and the list is still a list. It reads as a management tool more than a library.

**Data needed.** Nothing new for the layout. Moving a book from this page is a new action there.

## Comparison

| | A · Bookcase wall | B · Shelf ribbons | C · Shelf map | D · Column browser |
| --- | --- | --- | --- | --- |
| Shown at once | One bookcase in detail, fill level of all 8 | About 80 covers of one bookcase | All 49 shelves, 9 covers of one shelf | 21 books of one shelf with their details |
| Covers | Two rows for the selected shelf | One row per shelf | One row for the selected shelf | None |
| Meets "one cover high, two at most" | Yes, two rows | Yes, one row per shelf | Yes, one row | Not applicable |
| New data needed | Books and page counts of the open bookcase | First books of every shelf of the open bookcase | None | None |
| Effort | Highest | Medium | Lowest | Low to medium |

## Spine drawing rules

These rules apply to proposal A if it is chosen. Values in pixels are starting points to tune on real shelves.

A spine is one book on the drawn shelf.

**One spine per book.** A shelf with 12 books shows 12 spines; one with 64 shows 64. Registering a book on a shelf adds a spine.

**Width from the page count.**

- The width grows with the book's page count, between a minimum and a maximum: about 6 px for the thinnest books and 22 px for 900 pages and more.
- **Minimum width:** a very short book, for example 20 pages, still gets the minimum width, so it stays visible and can be pointed at.
- **Fallback:** a book with no page count gets a default width of about 12 px, a mid-size book.
- The page count is a proxy for thickness, not a measure: a hardcover and a paperback with the same page count get the same width. The shelf will look plausible, not exact.

**Front first, then behind.**

- Spines fill the front of the shelf from the left.
- When the width of the shelf is used up, the following books are drawn faded behind the front ones.
- Because spines have different widths, a shelf of thick books spills behind sooner than a shelf of thin ones.
- This is decoration: the application chooses which books go behind. It is not a record of where a book stands.
- A cap is needed for very full shelves: past two layers the shelf simply looks full. The cap is still to define.

**A stable look.** The height and colour of a spine are derived from the book's identifier, so a shelf looks the same on every visit and does not reshuffle when a book is added.

**Two levels of fidelity.**

| Level | What a spine is | What it needs |
| --- | --- | --- |
| Count only | An anonymous book; the shelf is the clickable unit; widths cannot follow page counts | Nothing new: shelf counts already come with the bookcase list |
| Real books | A specific book, with its title on hover, a click to open it and a width from its page count | Every book of the open bookcase with its page count. The book list returns no page count today, and the page loads only the selected shelf, 24 books at a time |

Width from the page count requires the "real books" level.

## Open questions

From the issue, still to decide once a proposal is chosen:

- What is shown with each cover (title on hover, ownership, lent badge) and what moves to the book page.
- Accessibility: keyboard navigation, focus and screen reader labels, in particular for spines (A), cover strips (B) and grid cells (C).
- Window widths: how many covers, spines or columns fit, and what happens in a narrow window. The mock-ups are drawn at 1440 px only.

Raised by the study:

- Which proposal, or which combination. One combination discussed: C for the page with B's cover strip for the selected shelf.
- For A: the cap for very full shelves, and whether to start at the "count only" level or go straight to "real books".
- Search: every mock-up shows one field to find a book, shelf or bookcase, where the page searches only bookcases and shelves today. Its behaviour is not designed.
- The empty states (no bookcase, empty shelf) and the Guest view are not drawn for the new layouts.
