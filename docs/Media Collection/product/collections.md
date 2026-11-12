# Collections and shopping

Status: Task 1 product decisions complete. This document is the current business reference, not an implementation claim. Shared name-matching behavior belongs to the book-entry discussion; remaining screen refinements belong to the screen-design discussion.

## Purpose and identity

Manage the user's actual books and identify missing collection volumes while shopping. Pre-registering Not Owned books is supported but expected to be extremely rare; conflict safeguards must not dominate normal owned-library use.

A book belongs to at most one collection initially. Future multiple membership should remain possible, without selecting a technical design here. A collection is a named group with volume coverage, independently of physical bookcase/shelf location and tags.

## Creation, renaming, and deletion

- Save a book with an existing collection name to join it, or a new name to create its collection. Collection-name similarity checks apply; shared name comparison/normalization is addressed in Task 2.
- No separate empty-collection creation workflow is required.
- Renaming a collection updates its displayed name for every member book. Renaming to an existing collection's name is blocked with an explanation. Collection merging is a future feature.
- Deleting a collection preserves its books and clears their collection membership and volume coverage.
- A collection with no books does not exist: deleting, moving, or unlinking its final book automatically removes the empty collection. Moving/unlinking preserves the book itself.
- Changing ownership does not delete a record: Not Owned records keep their collection present.

Task 5.5 adds [collection-based titles](book-entry.md#collection-based-titles): renaming a collection updates generated member-book titles as well as the collection label; supplied titles remain unchanged. Moving a generated-title book or editing coverage regenerates its title. Individual unlinking requires a supplied title, prefilled with the last generated value for one-click acceptance. Deleting an entire collection instead keeps the last generated titles and clears their `titleGenerated` flags automatically along with membership/coverage; it does not require title entry for every book.

## Coverage and ownership vocabulary

- Owned / Not Owned: the two saved ownership statuses. Defaults are defined in the book rules.
- Inferred volume: a volume in the expected sequence with no saved book covering it. It is not an automatically created book record and has no invented ISBN or metadata.
- Missing: the shopping umbrella for expected volumes not covered by an Owned book, whether represented by a saved Not Owned book or inferred without a book record. It is not a third ownership status.

Ordinary collection membership requires a name and integer volume number. Fractions are excluded. Unnumbered specials remain standalone books initially; tags may group them without affecting numbered completeness.

## Volume 0 and expected range

'Includes volume 0' is a collection checkbox, off by default. The expected sequence starts at 1, or 0 when enabled, and ends at the highest saved covered volume, regardless of ownership.

Entering volume 0 (including in omnibus coverage) while the option is off asks the user to enable it. The book cannot retain that coverage with the option off. Disabling the option is blocked while a saved book still covers volume 0.

Removing the highest saved coverage recalculates the range from remaining books; the previous upper bound is not remembered. This accommodates correcting mistaken entries. Unknown future publications are not inferred beyond saved coverage; no automatic publication-monitoring feature was requested.

## Editions, omnibus books, and counts

Different editions may share volume coverage. One record per edition remains the rule; separately managed identical-edition/ISBN copies are excluded.

A normal book covers one number. An optional 'Covers several volumes' choice allows a consecutive integer range, such as 1-3, for an omnibus. Nonconsecutive selections are excluded. Coverage is entered explicitly, not inferred from the title. The printed title/omnibus number can differ from its original-volume coverage.

One Owned omnibus remains one book for library counts, location, and lending while satisfying every covered collection volume. Collection totals count distinct numbers, never book records; overlapping Owned coverage does not increase completeness. The range end contributes to the highest saved volume even when the omnibus is Not Owned.

Desktop collection details group editions under expandable volume entries so the user can choose the actual book. The same omnibus can cover several numbers without implying several physical books. Exact screen labels and visual treatment will be refined during the screen-design discussion.

## Finished

- Finished is explicitly set by the user, permitted only when every expected volume is covered by an Owned book.
- Achieving complete ownership never automatically sets Finished.
- Finished collections remain visible on desktop and are hidden from mobile shopping.
- A change leaving missing coverage automatically reopens a Finished collection.
- Users may also manually reopen a collection without gaps, for example when a series resumes.
- Deleting the highest coverage shrinks the expected range as above; do not manufacture a gap for the deleted upper bound.
- There is no final-volume marker determining visibility.

## Reading a whole collection

The desktop collection details page has the same personal **Read** toggle as a book's details page, under "Only your reading" (decided 2026-11-10, issue #25):

- It is pressed only when **every Owned book** of the collection is read by the signed-in account. While one Owned book is unread, it shows "Not read".
- Pressing "Not read" marks every Owned book of the collection read at once, without confirmation.
- Pressing "Read" asks for confirmation first, because it erases the account's reading status for the whole collection; confirming marks every Owned book not read.
- Not Owned books (planned or wanted volumes) are never changed. A collection without Owned books shows no toggle.
- Like a book's reading status, it is personal: Owners/Admin only, no Guest display, and another account's status never changes. The change is one audited operation on the collection, with each changed book recorded as a related change.
- Desktop only: Leaf does not offer it.

## Batch edit

The desktop collection details page lets Owners/Admin change several books of the collection at once (decided 2026-11-10 and 2026-11-11, issue #24). A batch only holds books of that one collection.

- **Choosing the books:** **Edit several** turns the volume list into a list of the collection's books, each once (an omnibus is listed once), with a checkbox, **Select all** and **Select owned**. **Edit N books** opens the batch form. Guests do not see the mode.
- **Fields:** each field starts as **Leave unchanged**. A clearable field has three states: Leave unchanged, set to a value, or an explicit **Clear**, so an empty input never clears by accident.

  | Field | How the batch value applies |
  |---|---|
  | Category (Books, Manga, Comics) | Replaced. See "To Books" below |
  | Ownership (Owned, Not owned) | Replaced. A lent book set to Not owned is skipped |
  | Publisher | Replaced, or cleared |
  | Price | Replaced, or cleared |
  | Shelf (bookcase and shelf) | Replaced, or cleared (no physical location) |
  | Tags | **Add these** and **remove these** (existing tags only), never a full replacement: each book's other tags stay |
  | Authors | The whole list replaced, in the typed order. The similar-author check runs once on the typed names, as on the book form |
  | Own reading status | Read / Not read for the **signed-in account only** |
  | Titles | **Leave unchanged / Use the generated title** |

- **Never in a batch:** ISBN, cover, title text, summary, page count, publication date, personal note, collection membership and volume numbers.
- **Use the generated title** only changes hand-written titles of the chosen **Manga and Comics** books: they become `Name Vol. N` (`Name Vol. N–M` for an omnibus) and generated. Books are left out. Choosing the books and this option is the explicit choice; hand-written titles are never replaced by default.
- **To Books:** changing Manga or Comics books with a generated title to Books keeps each current `Name Vol. N` as a hand-written title, as when a whole collection is deleted. No title has to be typed per book.
- **Summary before saving:** the server plans the batch without saving it. The summary lists, per book, each change as "old → new" (including "old title → new title"), the books already as asked, and the books **left out with the reason**. Saving applies the changes to the other books in **one transaction**.
- **A book that cannot take a change is skipped**, not the whole batch, and gets **none** of the batch's changes, so a book is never half-edited. Reasons: a lent book set to Not owned; a book without ISBN whose new authors would make it a possible duplicate of another book (the chosen books are not compared with each other); Use the generated title on a Books book.
- **Refusals:** the whole request is refused when one chosen book is not (or no longer) in the collection, when a value is invalid (for example a price), or when a typed author looks like an existing one: the form then asks once which author is meant and plans again. A change of ownership follows the duplicate-purchase rules below; a coverage conflict refuses the save.
- **Audit:** one audited operation on the collection (`collection.books-batch-edited`, the batch edit of that collection), with each book's changes as related changes (`book.updated`, `book.organised`, `book.reading-status-changed`), as a collection rename records retitled books.
- Desktop only: Leaf does not offer it. The collection Read button (above) stays separate; the batch reading status is for a chosen selection.

## Duplicate-purchase prevention

Coverage overlap is allowed only between Owned books. Not Owned books cannot overlap either Owned or Not Owned coverage, including omnibus ranges. Apply this rule to additions, coverage edits, ownership changes, and collection moves. Any partial overlap blocks the entire conflicting operation unless resolved explicitly; do not silently trim or split a book.

ISBN uniqueness separately prevents adding the same identified edition twice. Different ISBNs can still describe editions of the same collection volume, so ISBN uniqueness does not replace coverage validation. No-ISBN duplicate detection belongs to Task 2.

When adding an Owned book conflicts with one planned Not Owned book, offer explicit choices:

1. Cancel.
2. Delete the conflicting planned record and continue adding the purchased book.
3. Update the planned record to the purchased edition and mark it Owned. If edition information differs, explicitly replace that information too; do not merely claim ownership of the wrong edition.

Show the affected record and changes before confirmation. For an existing same-ISBN edition, update the existing record rather than create a duplicate. Never silently delete/change records.

For an Owned omnibus overlapping several planned records, offer Cancel or delete all conflicting planned records and add the Owned omnibus. The same choice applies to partial overlap: replacing planned omnibus 1-5 with purchased omnibus 1-3 deletes the entire planned book. Warn that expected coverage may shrink to 3 if no other records establish 4-5. Do not split, trim, or automatically generate records. These are safeguards for rare pre-registration, not an expanded planning/wishlist feature.

## Mobile shopping

- Show unfinished collections even when they have no gaps. Finished collections are hidden.
- Missing volumes are compact 'Volume #' entries ('Tome #' in French), including saved Not Owned coverage and inferred volumes, listed from the highest volume number to the lowest, so the volumes closest to the last one owned come first (decided 2026-11-11).
- Emphasize last owned: the highest number covered by any Owned book, including an omnibus range end. Manga/Comics show its volume number; Books also show its title. Do not expand Owned editions in this compact view.
- No gaps: show 'No known missing volumes' and last owned. No Owned books: show missing entries and 'No books owned yet', without last owned.
- An eligible saved ordinary Not Owned entry lets Owners/Admin request marking the existing book Owned. Require a confirmation modal; cancel changes nothing. An inferred volume is non-clickable and requires book creation through desktop manual entry or the mobile scan/lookup flow. Mobile has no manual-entry fallback, as clarified in Task 6.
- Omnibus books do not benefit from quick add initially. If ambiguous Not Owned coverage is encountered, quick add is unavailable; do not add an edition picker.
- Mobile shopping is Owner/Admin-only. Task 6 supersedes the earlier Guest mobile read-only access; Guests retain desktop read access but cannot access the mobile interface.
- An Owned edition covers its volumes once; extra Owned editions do not produce extra shopping progress.

A separate desktop page mirroring mobile ownership progression is future scope, distinct from initial desktop collection details. Mobile interaction refinements and lookup/scan failure states belong to Tasks 2 and 6, without reopening these ownership rules.

## Acceptance examples

1. Only Owned volume 20 is saved: infer missing 1-19; last owned is 20.
2. Owned 5 and Not Owned 10 are saved: infer the absent numbers through 10; 10 is a saved missing volume. Last owned is 5.
3. Enable volume 0 with no record covering 0: 0 participates in missing coverage. Saving coverage of 0 cannot leave the option disabled.
4. Delete the only record covering highest volume 20, with remaining highest 19: expected range ends at 19. If no books remain, remove the collection.
5. Owned volumes 1, 2, 3 paperback, 3 hardcover, and 5: five book records, four distinct Owned volumes, five expected volumes, and missing 4.
6. Owned omnibus 1-3 plus Owned ordinary 2: two book records, three distinct Owned volumes. No extra completeness for overlapping 2.
7. Save a new missing volume in a Finished collection: it becomes unfinished. Filling the gap does not automatically mark Finished again.
8. Owned omnibus 1-3 blocks adding Not Owned 2; Owned 2 blocks adding Not Owned omnibus 1-3. Two Not Owned books cannot overlap either.
9. Resolve planned Not Owned 1/2/3 by confirming deletion and adding purchased Owned omnibus 1-3; do not leave conflicting planned records.
10. Delete a collection: keep all books but remove membership/coverage. Move its final book elsewhere: keep that book and remove the now-empty collection.
11. An unfinished collection with all known volumes Owned stays visible on mobile with last owned and no known gaps.
12. Mobile quick add of a saved ordinary Not Owned book requires confirmation; inferred volumes and omnibus books cannot use it.
13. Owned 1 read, Owned 2 unread, Not Owned 3: the collection shows "Not read"; pressing it marks 2 read and leaves 3 unchanged, and the toggle shows "Read". Pressing "Read" and confirming marks 1 and 2 not read; another Owner's statuses are unchanged.
14. Batch edit of Gunnm 1–3, Publisher set to Glénat, Price left unchanged: the three books get Glénat and keep their prices. Price set to Clear: the three prices become unknown.
15. Batch edit of Gunnm 1 (lent) and 2, Ownership Not owned and Publisher Glénat: the summary lists 1 as left out ("Lent: cannot be set to Not owned"); saving changes 2 only, and 1 keeps its publisher too.
16. Gunnm 1 titled "Gunnm, the first" (Manga) and a Books record "Gunnm, the novel", Use the generated title: the summary shows "Gunnm, the first → Gunnm Vol. 1" and lists the novel as left out.
17. Gunnm 1–2 with generated titles changed to Books: they keep "Gunnm Vol. 1" and "Gunnm Vol. 2" as hand-written titles.
18. Add tag Cyberpunk and remove tag Old on a book tagged History and Old: it ends with Cyberpunk and History.
19. Saving records one operation: the collection entry plus, per changed book, its related changes. Another account's reading status never changes.

## Implementation references

[task-03-collections](../plans/task-03-collections.md), [design-fix-collections](../plans/design-fix-collections.md). See the [global implementation plan](../plans/implementation-plan.md) for status and resume instructions.
