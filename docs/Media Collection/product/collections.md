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

## Category

A collection follows the volumes of one series, so all its books have the same category: Books, Manga or Comics (decided 2026-11-13, issue #74). A guide book for a manga, for example, is not part of that manga's collection.

- **Stored on the collection:** a new collection takes the category of the book that creates it. The category shows on the collection page and on each card of the Collections page. **Add a book** from a collection page starts the form with that category.
- **The form follows an existing collection** (decided 2026-11-14): when the collection name matches an existing collection, the book form (Libris and Leaf) switches the category to the collection's and locks it, with a hint naming the collection; a catalogue lookup cannot override it. Untick *Part of a collection* or type a name matching no collection and the category chosen before comes back. On the edit form of a book that stays in its collection the category is not locked: changing it offers to change the whole collection (below).
- **Every way of joining is checked:** creating or editing a book (Libris and Leaf), the v1 import and the future bulk add of volumes. A book of another category is refused with the collection's name and category ("Naruto holds Manga. This book is Books."). The book form offers **Use Manga for this book**, which changes the book's category and saves again. Nothing changes silently.
- **Changing a member book's category** opens a dialog instead: "Naruto holds Manga. Change the whole collection to Comics?", with the number of books that will change. **Cancel** keeps the form as it is; **Change the whole collection** changes the collection and all its books, then saves the rest of the form. Taking the book out of the collection stays possible.
- **Changing a whole collection:** the **Category** choice of the Edit collection dialog changes the collection and every book in it in one step, and says how many books change. Owners/Admin only. It is one audited operation on the collection (`collection.updated`) with each changed book as a related record (`book.category-changed`); Activity shows a single entry ("You changed the collection Naruto and its 12 books to Manga").
- **To Books:** changing Manga or Comics books with a generated title to Books keeps each current `Name Vol. N` as a hand-written title, as when a whole collection is deleted.
- **Batch edit** has no Category field: the collection's Category does that job for every book at once.
- **Collections filter:** the Category filter of the Collections page uses the collection's own category, combined (AND) with the book criteria.

### Collections created before the rule

The upgrade gives each existing collection the category most of its books have; a tie goes to Books, then Comics, then Manga, and an empty collection takes Books. Books are not changed. The existing databases were checked before the upgrade and hold no book of another category than its collection, so no list of mismatched books is offered (decided 2026-11-14). From then on the rule applies to every change.

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

Desktop collection details show the collection as a wall of covers in volume order, wrapping across the full width of the page. Each book is one tile: its cover, or a **No cover** placeholder with a solid border when it has none (missing volumes have a dashed one), its title and a muted line (Owned or Not owned, Omnibus with its range, Books for the Books category). Several editions of the same volume each get their own tile, side by side; an omnibus appears once, at its first volume, so the same omnibus covering several numbers never looks like several physical books. Clicking a tile opens the book's details page. Each expected volume with no saved book appears in its place as an empty dashed tile, for example **Volume 10 · Missing**; it opens nothing and cannot be chosen in **Edit books**. A planned volume shows its saved Not owned book instead (redesigned 2026-11-13; the expandable volume entries are gone).

## Finished

- Finished is explicitly set by the user, permitted only when every expected volume is covered by an Owned book.
- Achieving complete ownership never automatically sets Finished.
- Finished collections remain visible on desktop and are hidden from mobile shopping.
- A change leaving missing coverage automatically reopens a Finished collection.
- Users may also manually reopen a collection without gaps, for example when a series resumes.
- Deleting the highest coverage shrinks the expected range as above; do not manufacture a gap for the deleted upper bound.
- There is no final-volume marker determining visibility.

On the desktop collection details page, a short status label follows the collection name: **Finished** (green) or **Unfinished** (amber). The coverage line above the expected range only counts what is missing (for example **3 missing**, **No known missing volumes**, or **Complete** on a Finished collection). Hovering or focusing the **Finished** label explains that Finished collections remain on desktop and are hidden from mobile shopping. While volumes are missing, **Mark Finished** stays unavailable, and hovering or focusing it shows the condition: own every expected volume before marking the collection Finished. These replace the full-width green and amber lines under the summary (redesigned 2026-11-13, issue #24).

## Reading a whole collection

The desktop collection details page has a personal reading toggle, at the right of the **Volumes** heading; hovering or focusing it explains its scope (decided 2026-11-10, issue #25; placement redesigned 2026-11-13 with alternative A of issue #24):

- It is pressed only when **every Owned book** of the collection is read by the signed-in account, and then reads **All read**. While one Owned book is unread, it reads **Mark all read** (a book's own toggle keeps "Read" / "Not read"; the collection labels say it acts on every book, redesigned 2026-11-13).
- Pressing "Mark all read" marks every Owned book of the collection read at once, without confirmation.
- Pressing "All read" asks for confirmation first, because it erases the account's reading status for the whole collection; confirming marks every Owned book not read.
- Not Owned books (planned or wanted volumes) are never changed. A collection without Owned books shows no toggle.
- Like a book's reading status, it is personal: Owners/Admin only, no Guest display, and another account's status never changes. The change is one audited operation on the collection, with each changed book recorded as a related change.
- Desktop only: Leaf does not offer it.

## Batch edit

The desktop collection details page lets Owners/Admin change several books of the collection at once (decided 2026-11-10 and 2026-11-11, issue #24). A batch only holds books of that one collection.

- **Choosing the books:** **Edit books** turns the same wall of covers into a selection: each book gets a round check and clicking a cover adds or removes it instead of opening the book. Missing volumes stay in place but cannot be chosen and are not counted; a bottom bar counts the chosen books and offers **Select all**, **Select owned**, **Clear**, **Cancel** and **Edit N books**. While books are being chosen, changed and reviewed, the reading toggle and the **Edit books** button are hidden. Guests do not see the mode (redesigned 2026-11-13, alternative A of issue #24).
- **Side drawer:** **Edit N books** opens a drawer on the right, in three steps (Choose, Change, Review). The covers stay visible and clickable beside it, so the selection can still change. Escape or the close button closes the drawer and goes back to the selection.
- **Fields:** nothing is listed as Leave unchanged: the drawer starts empty and each field to change is added as a card (**+ Ownership**, **+ Publisher**…) and can be removed again. A field that is not added stays as it is on every book. Publisher, Price and Shelf cards offer **Set to** (Shelf: **Place on a shelf**), **Fill if empty** or an explicit **Clear**, so an empty input never clears by accident. Fill if empty applies the value only to the chosen books that have none for that field; the others keep theirs.

  | Field | How the batch value applies |
  |---|---|
  | Ownership (Owned, Not owned) | Replaced. A lent book set to Not owned is skipped |
  | Publisher | Replaced, filled if empty, or cleared |
  | Price | Replaced, filled if empty, or cleared |
  | Shelf (bookcase and shelf) | Replaced, filled on the books without one, or cleared (no physical location) |
  | Tags | **Add these** and **remove these** (existing tags only), never a full replacement: each book's other tags stay |
  | Authors | The whole list replaced, in the typed order. The similar-author check runs once on the typed names, as on the book form |
  | Own reading status | Read / Not read for the **signed-in account only** |
  | Titles | **Leave unchanged / Use the generated title** |

- **Never in a batch:** category (see [Category](#category)), ISBN, cover, title text, summary, page count, publication date, personal note, collection membership and volume numbers.
- **Use the generated title** only changes hand-written titles of the chosen **Manga and Comics** books: they become `Name Vol. N` (`Name Vol. N–M` for an omnibus) and generated. Books are left out. Choosing the books and this option is the explicit choice; hand-written titles are never replaced by default.
- **Summary before saving:** the server plans the batch without saving it. The review groups the plan **by change** (for example "Publisher → Glénat, 2 books", with each book's previous value and how many other books stay as they are), with a **Left out** card per book left out and its reason; a switch groups it **by book** instead, each change as "old → new" (including "old title → new title") and the books already as asked. Each cover then shows how many changes its book gets, or that it is left out; clicking a cover shows only that book's changes. Saving applies the changes to the other books in **one transaction**.
- **After saving:** the drawer closes and a banner gives the number of books updated and each book left out with its reason. The covers show **Updated** or **Left out**; **Edit books again** starts a new batch and **Done** goes back to the collection.
- **A book that cannot take a change is skipped**, not the whole batch, and gets **none** of the batch's changes, so a book is never half-edited. Reasons: a lent book set to Not owned; a book without ISBN whose new authors would make it a possible duplicate of another book (the chosen books are not compared with each other); Use the generated title on a Books book.
- **Refusals:** the whole request is refused when one chosen book is not (or no longer) in the collection, when a value is invalid (for example a price), or when a typed author looks like an existing one: the form then asks once which author is meant and plans again. A change of ownership follows the duplicate-purchase rules below; a coverage conflict refuses the save.
- **Audit:** one audited operation on the collection (`collection.books-batch-edited`, the batch edit of that collection), with each book's changes as related changes (`book.updated`, `book.organised`, `book.reading-status-changed`), as a collection rename records retitled books.
- Desktop only: Leaf does not offer it. The collection Read button (above) stays separate; the batch reading status is for a chosen selection.

## Add missing volumes

The desktop collection details page lets Owners/Admin add the missing volumes of a series from the BnF catalogue instead of scanning or typing each one, mainly at first use (decided 2026-11-11, issue #31). Leaf does not offer it.

- **Entry point:** **Add volumes up to…** asks for the last volume number X. Every **missing** number from the start of the collection (1, or 0 when it includes a volume 0) up to X is looked up, gaps included: owning 1, 2 and 5, "up to 8" looks up 3, 4, 6, 7 and 8. A number already covered by any book (Owned or Not owned, an omnibus range included) is not missing. At most 200 volumes per request.
- **Anchor:** the edition comes from a volume already in the collection. One BnF request asks for every member's ISBN at once; the highest-numbered volume the BnF knows is the anchor, and its record gives the series name and the publisher. When none is known, nothing is added and the page says the edition was not found in the BnF catalogue.
- **Series lookup:** one more BnF request asks for the series by name and publisher (a thousand records per request, more pages only for longer series). A record is a candidate when it has an ISBN, a volume number (series field, `T. 5`, `[106]`, or a title such as "One Piece 113") and exactly the anchor's series name (case and accents ignored). Spin-offs under another series name are left out.
- **Editions:** the candidates of one number are ranked by closeness to the anchor: the same subtitle first (so Mars Chronicle or Color Walk volumes filed under the main series come last), then the most ISBN digits in common (publisher block), then the nearest publication year. The best one is preselected; the others can be picked in a list. An ISBN already in the library is shown as **Already in your library** and cannot be added.
- **Review before saving:** one row per missing volume, ticked by default, with its number, cover, title, ISBN and year. A row can be unticked. A number the BnF does not list shows **Not found in the BnF catalogue**; it is not created and stays an inferred missing volume. Nothing is saved before the review is confirmed.
- **Ownership:** Owned by default, changeable per row, with a control to set every row at once (Not owned makes a shopping list).
- **What each new volume gets:** from the anchor, its category, publisher, bookcase and shelf, tags, and the signed-in account's own reading status; from its BnF record, ISBN, publication year, page count, summary and authors (an author already in the library keeps its existing name; the anchor's authors when the record has none); its collection and volume number from the row.
- **Titles:** Manga and Comics get the generated title (`Name Vol. N`). The row also shows the BnF's title as a suggestion ("BnF suggests: OK, let's stand up !") with **Use as title**, and the generated title can be taken back. Books get the BnF's title.
- **Covers:** fetched during the review, one at a time in the background, and filling the rows as they arrive. They use at most half of Open Library's request budget (one every 6 seconds), shared with single lookups, so a single lookup made meanwhile still works. When Open Library asks to wait, the queue waits; closing the review stops it. A volume whose cover has not arrived is saved without one (the "Without cover" filter finds it later). A row with no cover, or one still on its way, offers **Find a cover**: the same picker as the book form (web image search by the ISBN, image address, file, drop or paste). A picked image stops the fetch for that row and is saved with the volume; changing the row's edition drops it.
- **Saving:** all ticked rows in one operation. A row whose number or ISBN was taken meanwhile is left out and reported; the others are saved. The banner gives the number of volumes added and each one left out.
- **Audit and Activity:** one audited operation on the collection (`collection.volumes-added`, listing the books created and the rows left out), with each new book as a related `book.created`. Activity shows a single entry: "You added 4 volumes to the collection Gunnm".
- **Credit:** the review names its source, the BnF catalogue (Licence Ouverte).

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
13. Owned 1 read, Owned 2 unread, Not Owned 3: the collection shows "Mark all read"; pressing it marks 2 read and leaves 3 unchanged, and the toggle shows "All read". Pressing "All read" and confirming marks 1 and 2 not read; another Owner's statuses are unchanged.
14. Batch edit of Gunnm 1–3, Publisher set to Glénat, Price left unchanged: the three books get Glénat and keep their prices. Price set to Clear: the three prices become unknown.
15. Batch edit of Gunnm 1 (lent) and 2, Ownership Not owned and Publisher Glénat: the summary lists 1 as left out ("Lent: cannot be set to Not owned"); saving changes 2 only, and 1 keeps its publisher too.
16. Gunnm 1 titled "Gunnm, the first" (Manga) and a Books record "Gunnm, the novel", Use the generated title: the summary shows "Gunnm, the first → Gunnm Vol. 1" and lists the novel as left out.
17. The Gunnm collection with generated titles 1–2 changed to Books: they keep "Gunnm Vol. 1" and "Gunnm Vol. 2" as hand-written titles.
18. Add tag Cyberpunk and remove tag Old on a book tagged History and Old: it ends with Cyberpunk and History.
19. Saving records one operation: the collection entry plus, per changed book, its related changes. Another account's reading status never changes.
20. Batch edit of Gunnm 1 (publisher Glénat) and 2 (no publisher), Publisher Fill if empty with Delcourt: the summary shows 2 "none → Delcourt" and 1 as already as asked; saving gives 2 Delcourt and 1 keeps Glénat.

21. Naruto (Manga): saving a new Books guide into it is refused with "Naruto holds Manga. This book is Books."; **Use Manga for this book** saves it as Manga.
22. Naruto volume 3 changed to Comics on its form: the dialog offers to change the whole collection (12 books); confirming makes Naruto and its 12 books Comics, then saves volume 3.
23. Upgrade of a collection holding two Manga and one Comics book: the collection becomes Manga and no book changes.
24. Gunnm owns 1, 2 and 5, Add volumes up to 8: the review lists 3, 4, 6, 7 and 8; saving the ticked rows adds them in the edition of volume 5, with the publisher, shelf and tags of volume 5.
25. Gunnm's anchor is the 2000 edition (`2-7234-…`): volume 1 offers the 2000 edition first, then the 2016 edition, then Mars Chronicle volume 1; the 1995 edition (series "Gunnm.") is not offered.
26. One Piece volume 10 is catalogued as "OK, let's stand up !": the row offers it with the title One Piece Vol. 10 and "BnF suggests: OK, let's stand up !".
27. No volume of the collection is known to the BnF: nothing is added and the page says the edition was not found in the BnF catalogue.
28. Volume 3 is added by someone else while the review is open: saving leaves volume 3 out with its reason and adds the other ticked volumes.

## Implementation references

[task-03-collections](../plans/task-03-collections.md), [design-fix-collections](../plans/design-fix-collections.md). See the [global implementation plan](../plans/implementation-plan.md) for status and resume instructions.
