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
- Missing volumes are compact 'Volume #' entries ('Tome #' in French), including saved Not Owned coverage and inferred volumes.
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
