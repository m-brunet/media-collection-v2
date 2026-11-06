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

## Tags

Tags are reusable and a book can have several. Owners/Admin can create tags directly while editing a book and manage them from a dedicated interface. Guests can view and filter by tags, but cannot manage tags or assignments.

Tags are independent identities linked to books by ID, as explicitly requested. Renaming a tag updates its displayed label everywhere without changing its identity or assignments. Renaming to an equivalent existing tag is blocked; tag merging is future scope. Equivalent tag names reuse the existing tag. Comparison ignores case, accents, and outer whitespace; display labels retain their spelling and accents.

Removing a book/tag association or deleting a tag preserves books. Global deletion requires confirmation showing the number of affected books; remove only the tag and its associations. Unused tags persist until explicitly deleted, unlike auto-removed empty collections/authors.

### Confirmed filter semantics

Each tag has an independent Include or Exclude choice. Every included tag must be present; any excluded tag rejects a book. Example: include Fantasy and Adventure, exclude Medieval returns books with both included tags and without Medieval. This is one combined search, not separate include/exclude modes. The Nethys reference specifies behavior, not the interface design.

## Search and ordering baseline

Book and collection listings support simple search, advanced multiple-criteria filtering, and ordering. Simple search covers title, authors, ISBN, and collection name, using partial matches insensitive to case and accents (for example, 'tolk' matches 'Tolkien'). ISBN searches recognize equivalent ISBN-10/13 values. Advanced book filters initially cover category, authors, collection, bookcase/shelf, tags, ownership, and personal reading status. Guests have no reading-status filter.

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

## Assigned follow-ups

Task 6 handles the exact tag-filter controls, list/card composition, display wording, and loading/empty/error states, preserving these rules. Technical agents choose storage, query mechanics, and similarity algorithms. No clickable bookcase visualisation or tag-merging feature is introduced; those remain future scope.

## Implementation references

[task-04-locations-tags-search](../plans/task-04-locations-tags-search.md). See the [global implementation plan](../plans/implementation-plan.md) for status and resume instructions.
