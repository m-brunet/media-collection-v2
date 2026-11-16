# Locations, tags, search, and ordering

Status: Task 3 product decisions complete. This document records accepted product rules and acceptance examples, not an implementation plan. Exact visual treatment and error-state layouts belong to Task 6.

## Physical location

Create a freely named bookcase, then freely named shelves inside it, on the Bookshelves page. These locations must exist before assigning a book; inline creation from a book form is not included initially.

Assignment is optional, but an assigned book targets one shelf, never a bookcase alone. Display the location as 'Bookcase name - Bookshelf name'. There is no Room level. Locations are physical storage, not genres, collections, or reading statuses.

Bookcases and shelves are separate identities, with books linked to shelves. This identity direction was explicitly requested; detailed implementation choices remain with technical agents.

### Names and changes

- Bookcase names are unique across the installation.
- Shelf names are unique within their parent bookcase. Different bookcases can each contain 'Top'.
- Apply the established comparison rules: ignore case, accents, and outer whitespace while preserving display labels.
- Renaming updates displayed locations for all assigned books. A conflict in the applicable name scope blocks the rename; no automatic merging.
- A shelf can move to another bookcase. It keeps its assigned books, whose displayed location reflects the new parent. Block the move if a shelf with an equivalent name exists in the destination.
- Empty bookcases and shelves remain available, since users create them before assigning books. Unlike collections/authors, they are not removed automatically for having no book associations.

### Deletion

Deleting a shelf unassigns its books without deleting the books. Deleting a bookcase removes its shelf definitions and unassigns all affected books, preserving every book. Before confirmation, show how many books become unassigned and clearly state that no books are deleted.

Only Owners/Admin manage locations and book assignments; Guests view them under the shared-library permission rules. A clickable visual representation of bookcases remains future scope; this hierarchy does not require that visual feature initially.

### Bookshelves page list

The Bookshelves page lists the bookcases beside the detail of the selected shelf or bookcase. The selection is kept in the address, so it survives a reload and a link.

- Bookcases are collapsed: each shows only its name and shelf count until opened.
- One bookcase is open at a time. Selecting a bookcase opens it and closes the others; the bookcase holding the selection (the selected bookcase, or the bookcase of the selected shelf) is the open one.
- A chevron beside each bookcase opens or closes it without changing the selection. Opening one with its chevron closes the others.
- Nothing is remembered: on arrival, only the bookcase holding the selection from the address is open.
- While the search field is filled, every bookcase shown by the search is open, so the matching shelves are visible.
- The list never grows taller than the page: it has its own scrollbar and the detail panel beside it stays in view. The shelves of a collapsed bookcase are out of the keyboard Tab order.
- The Libris book form is not affected: it chooses a location with two short drop-downs, bookcase then shelf.

### Adding many books to a shelf

Decided 2026-11-16, issue #101. Design: Doop, page "Issue 101 · Add books to a shelf".

- **Where it starts:** *Add books* is the first of the shelf actions in the three Bookshelves views: the Wall panel, the actions menu of each Ribbons strip, and the header of the Columns books column. Guests have no such action, and the screen is not reachable for them.
- **Picking screen:** a screen of its own, "Add books to *Shelf*", with the bookcase name and the shelf's current book count. *Cancel* returns to the Bookshelves page with the same bookcase and shelf selected.
- **Finding the books:** the Library's search and advanced filters. The screen opens on *No physical location*; removing that filter shows shelved books too. These choices are not remembered. *Owned* is the fixed scope of the screen, shown as a locked choice; the advanced filters of this screen offer no ownership choice. A Not Owned book can still be given a shelf elsewhere.
- **Table:** a tick box and *Title*, then *Author*, *Collection*, *Location* and *Status*, without covers. It scrolls in place and loads the following books as it scrolls.
  - A book on another shelf can be ticked and moves; its current location is shown.
  - A book already on this shelf is dimmed, marked "Already here" and cannot be ticked.
  - A lent book can be ticked, shown as "Lent to *Name*"; lending keeps the shelf.
- **Limit:** 100 books at most per operation. *Select all* ticks every matching book that is not already on the shelf, and is available when at most 100 books match; above that it is disabled, with "Up to 100 books at once. Narrow the search to select them all." Ticking a 101st book by hand is refused with the same explanation. The selection is kept while the search or the filters change, and while the advanced filters are open.
- **Footer:** "38 books chosen", then what will happen: "29 placed on Shelf 3 · 9 moved from Hallway – Shelf 1 and Lounge · left – Shelf 2". The primary button reads "Place 38 books on Shelf 3" and is disabled while nothing is chosen.
- **After saving:** back on the Bookshelves page, on that shelf, with the counts updated and a message that repeats the summary. A refused save shows the error and keeps the screen and the selection.
- **Server rules:** Owner and Admin only. All or nothing: an unknown shelf, an unknown book, a Not Owned book or more than 100 books rejects the whole request, and no book changes. A book that reached the shelf since the screen was loaded is reported as unchanged, not as an error. Tags are never changed.
- **Activity:** one entry for the whole operation, "You placed 38 books on Study · oak – Shelf 3", counting the books placed and moved. An operation that changed no book shows nothing.
- Out of scope: ticking books in My books, and Leaf.

## Tags

Tags are reusable and a book can have several. Owners/Admin can create tags directly while editing a book and manage them from a dedicated interface. Guests can view and filter by tags, but cannot manage tags or assignments.

Tags are independent identities linked to books by ID, as explicitly requested. Renaming a tag updates its displayed label everywhere without changing its identity or assignments. Renaming to an equivalent existing tag is blocked; tag merging is future scope. Equivalent tag names reuse the existing tag. Comparison ignores case, accents, and outer whitespace; display labels retain their spelling and accents.

Removing a book/tag association or deleting a tag preserves books. Global deletion requires confirmation showing the number of affected books; remove only the tag and its associations. Unused tags persist until explicitly deleted, unlike auto-removed empty collections/authors.

### Confirmed filter semantics

Each tag has an independent Include or Exclude choice. Every included tag must be present; any excluded tag rejects a book. Example: include Fantasy and Adventure, exclude Medieval returns books with both included tags and without Medieval. This is one combined search, not separate include/exclude modes. The Nethys reference specifies behavior, not the interface design.

## Search and ordering baseline

Book and collection listings support simple search, advanced multiple-criteria filtering, and ordering. Simple search covers title, authors, ISBN, and collection name, using partial matches insensitive to case and accents (for example, 'tolk' matches 'Tolkien'). ISBN searches recognize equivalent ISBN-10/13 values. Advanced book filters initially cover category, authors, collection, bookcase/shelf, tags, ownership, cover (With cover / Without cover), price (With price / Without price), and personal reading status. Guests have no reading-status filter; they do have the cover and price filters.

Book sorting defaults to title A-Z, with ascending/descending directions for title, date added, and publication date. Books without publication dates appear last in either direction. Author sorting is not requested. Collection listings sort by collection name only, A-Z or Z-A, default A-Z; creation/publication-date sorting is not included for collections. Collection details keep volume/coverage order rather than confusing collection order with physical shelf order.

### Combining criteria

Different advanced-filter fields combine with AND: Manga plus Owned plus Bookcase A requires all three. Multiple selections within a non-tag field combine with OR: Manga plus Comics in the category selector accepts either. Tags retain their special rule: every included tag must be present and any excluded tag rejects the book.

Provide explicit No physical location and No collection options. These express absent assignments rather than creating special location/collection records. Simple search and advanced filters apply together, so search text further narrows the filtered result set.

### Collection listing matches and counts

When applying book-level criteria to the collection listing, show a collection if at least one of its books satisfies the entire combined search/filter expression. Do not let different books independently satisfy different fields. Selection OR and tag Include/Exclude rules still apply within that expression.

Collection ownership/completeness totals always describe the entire collection, not just matching books. Filtering a collection with eight of ten volumes Owned must not change that total into a count of the filtered subset. Counts continue to follow the distinct-volume and omnibus rules in [collections](collections.md).

## Acceptance examples

1. Create an empty bookcase and a shelf: both remain available without assigned books. Only the existing shelf can be assigned; bookcase-only assignment is not offered.
2. Two bookcases may each contain 'Top'; equivalent bookcase names or equivalent shelf names inside the same bookcase conflict.
3. Rename a location: assigned books display the new 'Bookcase - Bookshelf' label. An equivalent name in the same scope blocks the rename.
4. Move a shelf into another bookcase: keep book assignments and update the displayed parent; a destination shelf-name conflict blocks the move.
5. Delete a shelf/bookcase: confirmation shows the affected-book count. Confirming preserves books and unassigns them; deleting a bookcase also removes its shelf definitions.
6. Enter an equivalent tag name with different accents/case/outer whitespace: reuse the tag, retaining its display label. Rename changes the shared label; rename to another equivalent tag is blocked.
7. Remove a tag's final assignment: the tag persists. Global deletion confirms affected-book count and removes the tag/links, not books.
8. Manga or Comics selected with Owned and Bookcase A accepts either category but requires both ownership and location conditions.
9. Include Fantasy and Adventure, exclude Medieval: both included tags are required, and any Medieval tag rejects the book. Text search narrows the same result set.
10. No physical location and No collection select absent associations, not special invented records. Guests have no personal reading-status filter.
11. In a collection, book A matches an author and book B matches a required tag, but no single book matches both: that collection is excluded.
12. Search a matching book within a collection with eight of ten volumes Owned: its ownership total stays eight of ten.
13. Books offer title/date-added/publication-date sorting in either direction; missing publication dates stay last. Collections offer name sorting only.
14. Case/accent-insensitive partial text matches and equivalent ISBN-10/13 searches find existing records without requiring exact display spelling.
15. Without cover plus Without price finds the books missing both, owned or not; checking both choices of one of them removes that restriction. In the collection listing, Without cover lists each collection with at least one volume without a cover, and its totals still describe the whole collection.
16. Open *Add books* on Shelf 3: the screen lists the Owned books without a location. Tick five of them: the footer reads "5 books chosen" and "5 placed on Shelf 3 · none moved from another shelf", and the button "Place 5 books on Shelf 3".
17. Remove *No physical location* and search "pratchett": 41 books match, 3 of them "Already here" and not tickable. *Select all* ticks the 38 others; the footer counts the books placed and the books moved, naming the shelves they leave.
18. 214 books match: *Select all* is disabled with "Up to 100 books at once. Narrow the search to select them all."
19. Save 38 books of which one was shelved there in the meantime: 37 are placed or moved, one is reported as already there, and nothing fails.
20. One of the chosen books was deleted meanwhile: the save is refused, no book changes, and the screen keeps the selection.

## Assigned follow-ups

Task 6 handles the exact tag-filter controls, list/card composition, display wording, and loading/empty/error states, preserving these rules. Technical agents choose storage, query mechanics, and similarity algorithms. No clickable bookcase visualisation or tag-merging feature is introduced; those remain future scope.

## Implementation references

[task-04-locations-tags-search](../plans/task-04-locations-tags-search.md). See the [global implementation plan](../plans/implementation-plan.md) for status and resume instructions.
