# Book entry and assisted lookup

Status: Task 2 product decisions complete. This document records confirmed product behavior, not implementation choices. [Features](features.md) lists book fields; [collections](collections.md) defines coverage and ownership conflicts. Screen refinements and detailed mobile pages belong to Task 6.

## Collection-based titles

Additional product decisions confirmed on 2026-11-06; implementation belongs to [Task 5.5](../plans/task-05-5-generated-titles.md), before assisted entry and mobile implementation. These rules concern the application, not V1 import.

- A nonblank title remains mandatory in storage. Title input is mandatory for Books and for standalone Manga/Comics.
- Manga/Comics with collection membership may leave the title input blank or whitespace-only. The backend generates `Collection name Vol. N` for one volume, or `Collection name Vol. N–M` for consecutive coverage (`Vol.` in every interface language). Volume 0 uses the same format when enabled. Use the collection's display name, not its normalized comparison key.
- A supplied nonblank title is retained under normal title validation. Store `titleGenerated` to distinguish supplied titles from generated ones; never infer provenance from matching text. Existing V2 titles are retained with the flag false.
- While generation remains enabled, renaming the collection, changing coverage or moving the book to another collection regenerates its title. Supplied titles remain unchanged.
- Editing a generated title into a supplied title clears the flag, even if the supplied text happens to equal the fallback. Leaving a title blank on an eligible book selects generation. An unrelated edit must preserve generation rather than silently turn the displayed title into a supplied title.
- When individually removing collection membership or changing category to Books, require a supplied title before saving. Prefill the title input with the last generated title so the user can confirm it in one click or replace it. Saving that explicit choice clears the flag; a blank title is rejected. No separate mandatory rename or extra confirmation dialog is required.
- Deleting an entire collection preserves each book's last generated title and clears its flag automatically, while removing membership/coverage. Supplied titles are untouched. This is the bulk-deletion exception to the individual-edit rule.
- Generation is a backend business rule shared by all entry paths. The form explains conditional optionality; assisted lookup and mobile use the same rules when implemented. Valid titles and normalized search/sort keys must remain consistent after updates.

Acceptance examples:

1. Save a Manga in Gunnm covering volume 3 with blank title: store `Gunnm Vol. 3` and `titleGenerated=true`. A Comics range 1–3 generates `Collection name Vol. 1–3`.
2. Supply an individual tome title: store it with the flag false. Collection rename or coverage changes do not replace it.
3. Rename a collection or move/change coverage of a generated-title book: regenerate the title from current membership. An unrelated book edit preserves the flag.
4. Individually remove membership or change category to Books: show the last generated title in the required input; accepting it saves it as supplied. Clearing it prevents saving.
5. Delete the whole collection: preserve its books and last titles, clear generated flags and membership/coverage, without requiring a replacement-title form per book.
6. Upgrade existing V2 data: preserve all titles and set flags false, including titles whose text already matches the generated format.

## ISBN and duplicate entry

Accept valid ISBN-10 and ISBN-13 input. Convert ISBN-10 to equivalent ISBN-13 and display/use ISBN-13 consistently; equivalent identifiers must not allow duplicate editions. Book details show a small superscript information icon beside the ISBN label when an actual ISBN-10 conversion occurred, explaining why the displayed number differs from the entered one.

For a book without an ISBN, explicitly select 'This book has no ISBN'. A possible title/author duplicate produces an overridable warning. Shared comparison behavior is defined below; technical agents determine similarity mechanics without turning the warning into a hard duplicate block.

## Shared names and authors

For authors, collections, and receivers, compare names without capitalization, accents, or leading/trailing whitespace. Preserve their displayed spelling. Accent-only differences are equivalent, not merely similar. An exact match after this comparison reuses the existing identity; a similar match prompts Use existing or Create a different one. Do not allow another record with an equivalent name. Collapsing repeated internal spaces has not been specified.

The user's reference expression for technical agents is `value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();`. Implementation details are supplied/handled separately; this records the intended comparison behavior without choosing a similarity algorithm or threshold.

Authors are shared identities, stored independently and linked to books; a book can have several authors. The user explicitly specified an author table and book/author association table. New authors can be created through book entry and reused by name like collections. Correcting an author name changes it wherever that identity is linked. Selecting a different author for one book only changes that book's association, not the shared author's name.

Author creation/removal follows collection lifecycle: deleting, moving, or removing the final book association removes the unused author; removing an association preserves the book. Explicit author deletion preserves books and requires selecting a replacement wherever it would leave a book without any author. Otherwise the deletion cannot proceed. Renaming to an existing equivalent author name is blocked, with author merging left for the future. Shared name corrections require confirmation; selecting another author for one book is a different operation. No dedicated author-management interface is implied by these rules.

## Publication date and price

Publication date is optional and accepts only these states: absent, year only, or month plus year. Month without year is invalid and must be rejected by backend validation as well as explained in the form. There is no day field; do not invent a day for partial dates. A full lookup date is reduced to its month and year, omitting the day. No arbitrary product-specific year range has been selected; technical validation must preserve the agreed precision.

Price is optional and uses euros only. Empty/null means unknown or not supplied; zero means obtained free, such as an edition distributed at an event. Never convert one into the other. Accept nonnegative values with at most two decimal places, using either comma or dot as the input decimal separator. Display every supplied price with exactly two decimal places, including zero; null must not display as a free book. There is no currency selector or configurable installation currency initially. Changing currency is a possible future feature.

Page count is optional. When supplied, it must be a positive whole number. Unknown remains empty/null, not zero.

One record per edition is the accepted restriction. Different editions may have different ISBNs but overlapping collection coverage; the separate [collection conflict rules](collections.md) still apply.

## Assisted lookup

1. The user explicitly presses a lookup button such as 'Find book'. Typing an ISBN does not trigger retrieval automatically.
2. Check whether that ISBN already exists in the library before contacting an external source.
3. If it exists, redirect to that book's detail page instead of offering another creation. This redirects to the existing record; it does not automatically change ownership or assume the user intends to purchase it.
4. Otherwise retrieve available book metadata and populate an editable form.
5. The user reviews/corrects the result and explicitly confirms saving. Retrieval alone never creates a book.

Camera barcode scanning is mobile-only; do not add a scanner to Electron or the desktop-browser interface. On mobile, a successful scan is required to access the add form; scanning fills ISBN and the user presses Find book to start lookup. No manual ISBN-entry bypass is offered: camera/scan failure explains the problem and offers Retry or Back to home. No automatic lookup or creation occurs merely from scanning. Mobile is Owner/Admin-only, with no Guest access. Task 6 specifies mobile-specific failure and existing-record presentation, superseding any broader manual-fallback assumption on mobile. Desktop manual entry is unchanged. Provider selection remains a technical choice.

## Lookup sources

Decided 2026-11-06.

- One lookup asks several sources and combines them: a field missing from the preferred source is completed from the next ones. Where sources disagree, the preferred source's value is the first choice and the other values are offered as alternatives, each with its source. Values differing only by case, accents, punctuation or author name order count as the same.
- Covers come from their own list of sources. The same picture offered by several sources is shown once, at its best resolution. Very small thumbnails are not offered.
- **Kept covers** (decided 2026-11-16, issue #105): an ISBN has at most one cover, either on its book or kept.
  - Deleting a book, or removing its cover, keeps the cover under the book's ISBN. Replacing a cover deletes the old one. A book without an ISBN has its cover deleted, as before.
  - Adding a cover to a book whose ISBN has a kept cover deletes the kept one. A second cover kept for the same ISBN replaces the first.
  - The lookup offers the kept cover first, as "from your library", and then asks no cover source for that ISBN (Inventaire, Open Library); the information sources are still asked. The same holds for the covers of a series' volumes.
  - A cover removed by hand is therefore offered again for its ISBN; choosing another cover replaces it.
  - The data reset and the development commands keep these covers; see [features](features.md#data-reset).
  - **Deleting them** (decided 2026-11-16, issue #106): the Accounts page shows the Admin how many covers are kept, their size and the date of the oldest one, with *Delete kept covers*. After a confirmation naming the count and the size, every kept cover and its picture are deleted; covers on books are never touched. Nothing is deleted automatically and no password is asked. Activity records "You deleted 437 kept covers".
- **Inventaire covers** (decided 2026-11-16, issue #93): Inventaire is asked for covers only, never for book information; the BnF, the Sudoc and Open Library are the information sources. Its cover is the first choice, before Open Library's, each shown with its source; an existing cover is never replaced automatically. For the volumes of a series, Inventaire is asked first and Open Library only for a volume Inventaire has no cover for. Inventaire's data is CC0, but the pictures keep their own copyright: they are stored for the household's own library, never published.
- **Sudoc** (decided 2026-11-16, issue #92): the Sudoc, the union catalogue of French university libraries, is an information source of every single-book lookup, asked whether or not the BnF answers. It gives no cover. Order of preference: the BnF, then the Sudoc, then Open Library. A value the Sudoc shares with another source is credited to both; a different date, page count or other value is offered as an alternative, never written over the BnF's.
  - **Search first:** the ISBNs waiting for the Sudoc, up to 13, are asked together in one search, which returns their full records. A record is matched to an ISBN by its ISBNs (ISBN-10 and ISBN-13 count as the same), never by its position. An answer longer than one page of 50 records is read up to a second page.
  - **Then one by one:** the search leaves out some records that no library holds. Each ISBN it did not match is asked to the Sudoc's ISBN service, which gives its record numbers, and the first record is downloaded (a second one only if the first is empty). An ISBN that service does not know is "not found"; no record is then downloaded. An ISBN the search matched needs none of these requests.
  - **Trouble:** a search that fails or is asked to wait reports the Sudoc as unavailable for its ISBNs, and none is then asked one by one. A refusal or failure while asking one by one stops there: the ISBNs already answered keep their records, the others are reported as unanswered, not as unknown, and are asked again by a later lookup.
  - **One answer per ISBN:** when the Sudoc has several records for an ISBN, the first one that matches is used.
  - Translators and letterers are not authors. The Sudoc's data is under Licence Ouverte; it is credited in the Credits page, and each value names it in the review.
- A summary is kept only when it is in the edition's language (French users may own English books); otherwise the summary stays empty. Titles, authors and other fields come from the edition itself.
- The category is filled when a source tells it (decided 2026-11-10): in the BnF record, the comic class (686 $a 805) or form ("Bandes dessinées", 608) makes a Comics, and a Manga when translated from Japanese, Korean or Chinese (101 $c; manhwa and manhua count as manga); in Open Library, the work's subjects ("manga", "comic", "graphic novel"). Publishers are not used, since some publish both. The lookup's category replaces the form's without asking: on desktop it is shown in the review, and it can be changed in the form as usual. Without one, the form keeps its category (Books, or on the phone the last saved book's).
- Price and ownership are never filled from a lookup.
- An author already in the library is filled in under its existing name (decided 2026-11-10): a source's spelling with the same comparison key, or similar to exactly one existing author (the rule the save applies), becomes that author ("Flipsflops" from the BnF fills in "Flipflop's"). Under the authors, Libris and Leaf show "BnF suggests: Flipsflops (instead of Flipflop's)" with a button to use that spelling as a new author instead. Once that spelling is used, the form offers the existing author back, labelled Libris since it comes from the library ("Libris suggests: Flipflop's, already in your library"), and no longer offers it as the source's alternative. A spelling similar to several authors keeps its form, and the save asks which one is meant, as it does for names typed by hand.
- Sources with rate limits may be used only if the application respects those limits itself, before a source has to refuse anything. Requests identify the application, never a person; no contact email is sent.
- **Request queue** (decided 2026-11-16, issue #102): every outside service has one queue, shared by single lookups, bulk work and every user.
  - **Delay:** a fixed pause between the end of one request to a service and the start of the next: 3 seconds for the BnF (it publishes no rule), 2 seconds for Open Library (it allows 1 request per second without a contact email), 7 seconds for the Sudoc (its `robots.txt` asks for 5), 5 seconds for Inventaire (it enforces a limit it does not publish; the 10 seconds of its `robots.txt` are for web crawlers, not for its API; 3 seconds until 2.2.1, raised to be gentler on its servers, issue #120). A service has one request in progress at a time. Downloading a cover image from a service counts as a request to it.
  - **No retry:** a request that fails, times out (10 seconds, counted on the request itself, not on its wait) or is refused is never sent again automatically. The lookup says which source was unavailable and keeps the other sources' answers.
  - **"Retry later":** when a service answers "too many requests" or "unavailable", nothing more is sent to it before the time it gave, or for 60 seconds when it gave none. The requests that were waiting are refused, not kept for later.
  - **Single lookups first:** a single-book lookup goes ahead of waiting bulk requests. Bulk work puts one request at a time in a queue.
  - **Busy:** a request that would wait more than 2 minutes is refused at once, and one still waiting after 2 minutes is dropped. That source is reported as unavailable for that book.
  - **Kept answers:** a found answer is kept 7 days and a "not found" answer 1 day, in memory (lost on restart), up to 2,000 ISBNs per source; each keeps the date it was retrieved. A failure, a limit or a busy answer is never kept. A kept answer is reused without any request.
  - **No duplicate:** an ISBN already asked to a source, and not answered yet, is not asked a second time; both lookups get the same answer.
  - **Batches:** a source that accepts several ISBNs in one request (Open Library, up to 20; the Sudoc, up to 13; Inventaire, up to 10) gets the ISBNs that are waiting together. Each answer is matched to its ISBN by the ISBN, never by its position.
  - **Answer within 10 seconds:** a single-book lookup (Libris and Leaf) answers after 10 seconds at most with what has arrived, and names the sources still answering. Their requests go on, and their answers are kept. **Check again** repeats the lookup: kept answers come back at once and a request still in progress is joined, never sent twice.
  - **Cancelling:** closing the dialog of a volume search removes its waiting requests. A single lookup's requests are not cancelled, so that Check again finds their answers.
- Scraping shop websites is a last resort, used only after an explicit human decision; it is never the default.
- **Publisher's collection** (decided 2026-11-15, issue #82): the BnF record also gives the publisher's collection (UNIMARC `225 $a`, for example "Le livre de poche" or "Pôle fiction"), offered as a second publisher choice after the publisher of `210`/`214 $c`, which stays first and selected. A `225 $a` that names the book's own series ("Claymore" beside `461 $t` Claymore) is skipped; its numbering and ISSN are dropped, and brackets around a name supplied by the cataloguer too. Equal names from two sources make one choice credited to both; an abbreviation ("LGF") is never merged with a full name ("Librairie générale française"). See [issue-82-publisher-collection](../plans/issue-82-publisher-collection.md).
- **Series lookup** (decided 2026-11-11, issue #31): to add a collection's missing volumes, the BnF is also asked for a whole series by name and publisher, from the edition of a volume already owned. That search follows the same rules: it uses the BnF queue as bulk work, behind single lookups, "retry later" answers are honoured, and covers come from Open Library through its queue, also as bulk work. See [Add missing volumes](collections.md#add-missing-volumes).
- The preference order and the lists of sources are technical choices, made from a measured trial and approved by the user (Task 6).

## Failure and incomplete results

On desktop, if no book is found, an external service is unavailable, or the app encounters an error, preserve the entered ISBN and permit manual completion. Show clear feedback explaining the known problem. Do not silently fail or describe an application/service error as a successful search with no result. The interface need not expose internal implementation details or raw errors.

The manual-completion fallback above is desktop behavior. Task 6 explicitly restricts mobile: successful scan is required; failed lookup gets at most one retry, then error/Back to home and no manual fallback. A mobile existing Owned ISBN shows Already owned with scan-again/home options; an existing Not Owned ISBN shows that the book is already registered and offers Mark as Owned, reusing the existing record without any external lookup (Task 7). These mobile-specific decisions supersede the generic details redirect where applicable; see [mobile experience](overview-activity-mobile.md).

Populate empty fields from lookup while preserving manually entered values. If a result conflicts with a manually entered value, ask before replacing it. A lookup must not silently overwrite the draft.

Retain useful partial results and let the user complete missing information. Saving still requires all mandatory fields; an incomplete lookup does not waive those rules. Full publication dates are reduced to month/year as above. When several sources answer, combine them as described in [Lookup sources](#lookup-sources): the user reviews the combined values, sees the alternatives where sources disagree, and chooses the cover; nothing is applied without that review. Existing manual values remain protected by the replacement-confirmation rule. Manual entry always remains available on desktop; mobile failure behavior follows Task 6.

## Cover padding

Decided 2026-11-06. Many covers are online-shop thumbnails: the real cover centred in a white square. Shown whole in a
portrait frame, they look smaller than other covers and keep visible white edges. When a cover is saved (upload,
assisted lookup, V1 import), remove that padding automatically, without AI or network access:

- Measure from each edge the rows/columns that are near-white (every colour channel at least 235, allowing JPEG
  noise) on at least 99% of their pixels.
- Remove them only when they look like shop padding: white bars on exactly one pair of opposite sides (left/right or
  top/bottom), each at least 2% of the image dimension, of about the same width (difference at most 2 px or 10%), and
  at most 1 px on the other two sides. Otherwise store the cover exactly as provided.
- The rule never cuts into the cover itself: a cover whose own artwork is white at an edge is kept unchanged, even if
  that leaves some padding. A trimmed image is re-encoded at high quality; an untrimmed one is stored unchanged.

Trial on the 437 development covers (V1 import): 174 of 177 padded squares and 6 padded portraits trimmed to book
proportions (width/height 0.59–0.74); 3 left unchanged safely (grey padding, or white artwork at an edge); no cover
cut into. "Covers are shown whole, never cropped" still holds for display.

## Form structure

1. Visible main block: mandatory information/statuses, category, collection-membership controls and required coverage when enabled, plus the optional cover preview/upload control. A missing cover uses a neutral fallback; cover controls are always visible inside this first block.
2. Visible organisation block: optional bookcase/shelf assignment and tags.
3. Collapsed Additional information: publisher, publication date, summary, page count, and price. An 'Add a personal note' button reveals the note field. If the user's note already exists, opening this section shows it directly instead of the Add button.

The reading status in the main block (Libris add and edit forms, Leaf add form) is the same toggle button as on the book details page (decided 2026-11-10): it shows the status, "Read" (pressed) or "Not read"; one press marks the book read, another unmarks it. The details page shows no separate status sentence.

The category (Books, Manga, Comics) is a row of buttons in the same forms (decided 2026-11-10): all three are visible, the selected one has the pressed look, and pressing another selects it instead (a radio group: arrow keys move the choice, screen readers announce the "Category" group). Text labels for now; icons are studied separately. The Libris filters keep their list, which also offers "any". In a form it only changes the form's value, saved with the book; the default stays Not read.

## Personal notes and Guests

Owners/Admin may have one optional free-text note per book per user. Only the author may see its content; other Owners and Admin cannot access it. Shared book editing must not expose or overwrite another user's note. The privacy requirement must also be respected in any Activity or technical-log presentation; the technical mechanism is not selected here.

The author can delete their note without affecting the book. After removal, the interface returns to Add a personal note. Note editing/removal remains within the author's own note; it does not grant access to others' notes.

Guests have no personal notes feature and no reading-status display or controls. Guest accounts are not linked to lending receivers, even when the same person exists outside the application.

## Acceptance examples

1. Enter a valid ISBN-10: use/display its equivalent ISBN-13 and show the conversion information icon on details. Entering either equivalent cannot create another record of the edition.
2. Explicitly select no ISBN: permit saving after required title/authors and other mandatory fields are complete. A possible title/author duplicate warns but can be overridden.
3. Save without a cover: show a neutral fallback and keep the cover control available in the first section.
4. Open a new book form: main and organisation blocks are visible; additional metadata is collapsed; a new personal note needs its Add control.
5. A user has a note: opening Additional information shows it directly. Deleting it restores Add without deleting/changing the book. Another Owner/Admin cannot read its content; Guests have no note feature.
6. A Guest views a book: no personal reading-status controls/display or notes, and no account link to lending receivers.
7. Enter an equivalent author/collection/receiver name with different accents, case, or outer whitespace: reuse the identity. A similar but distinct name offers an explicit choice.
8. Correct an author: confirm the shared correction, reflected on linked books. Deleting an author that would leave a book authorless requires replacement; rename collision is blocked.
9. Leave publication date empty or enter year only/month-year: valid. Month alone is invalid. A full lookup date contributes only month/year.
10. Leave price empty: unknown, not free. Enter zero: free, displayed with two decimals. Negative or over-precision prices are invalid. Unknown pages remain empty; supplied pages must be positive integers.
11. Press Find book for an existing ISBN: open its details; do not create a duplicate or automatically change ownership. A new result needs editable review and explicit saving.
12. Lookup returns incomplete information or conflicts with a manual draft: keep useful data, ask before replacing conflicts, and require missing mandatory information before saving. Several sources are combined: the preferred value comes first, disagreements offer alternatives, and the user reviews before anything is applied.
13. Desktop lookup fails or finds nothing: preserve ISBN and manual completion, visibly explaining the known problem rather than silently failing. Mobile instead follows the scan gate and limited-retry/error-home rule confirmed in Task 6.
14. Desktop has no camera scanner. Mobile scanning fills ISBN; only pressing Find book starts lookup. No scanning or retrieval alone creates a book.
15. Save a cover that is a shop thumbnail (cover centred between two equal white bars): store it without the bars, in book proportions.
16. Save a cover whose artwork is white along one edge, or white on more than one pair of sides: store it unchanged.
17. Save a portrait cover without padding: store it unchanged, byte for byte.
18. The preferred source has no page count and another source has one: the review offers that page count, naming its source. Two sources give different publishers: the preferred source's publisher is selected first and the other is offered.
19. A French edition's only summary is in English: leave the summary empty. An English edition's English summary is kept.
20. One source is rate-limited or unreachable: the lookup completes with the other sources and says which source was unavailable; the limited source is not asked again before it allows it.
21. Two books are looked up one after the other: the second request to the BnF starts 3 seconds after the first one ended, and the second request to Open Library 2 seconds after. Neither lookup fails because of the wait.
22. A source has not answered after 10 seconds: Libris shows the values that arrived and says "No answer yet from BnF; the values found may be incomplete. Check again to see the rest." The Find book button reads **Check again**. Pressing it a few seconds later shows the BnF values too, without a second request to the BnF. On the phone, the same message appears with a Check again button, as often as needed; it does not count as the single retry of a failed lookup.
23. The same ISBN is looked up again the next day: every answer comes from the kept answers and no source is asked. Eight days later the sources are asked again.
24. A volume search has filled the BnF queue and a book is scanned meanwhile: the scan's request goes before the waiting search requests.
25. Inventaire and Open Library both have a cover for the ISBN: the review offers Inventaire's first, "Cover 1, from Inventaire", then Open Library's. Only Open Library has one: it is the only choice, as before.
26. Twelve volumes are found for a series: Inventaire is asked for the first one, then for ten together in one request, then for the last one. Each cover shows on its row once its picture is downloaded, about 5 seconds apart.
27. A book with a cover is deleted, then its ISBN is looked up again: the review offers "Cover 1, from your library", and neither Inventaire nor Open Library is asked. Saving the book with that cover leaves no kept cover for the ISBN.
28. A cover is removed from a book, then another picture is added to it: the removed cover, kept in between, is deleted.
29. The BnF and the Sudoc both know an ISBN, with the same title, the dates 2006 and 2007, and a page count only in the Sudoc: the review shows the title "from BnF, Sudoc", the date 2006 selected with 2007 "from Sudoc" as the alternative, and the page count "from Sudoc".
30. An ISBN whose record no library holds (Bitterblue, 9782253174011): the Sudoc's search does not return it, its ISBN service gives the record number, and the record is downloaded: three requests, 7 seconds apart. The lookup answers after 10 seconds with the other sources and "No answer yet from Sudoc"; Check again shows the Sudoc values.
31. The BnF is unreachable: the Sudoc and Open Library are still asked, and the review says the BnF did not answer.

## Assigned follow-ups

- Task 5: account-role/deactivation changes and any effect on retained personal data; do not infer access to another user's note.
- Task 6: detailed mobile pages, scanner/error states, field-level feedback, similarity-warning layout, and conversion-icon explanation. Keep the confirmed form structure and explicit actions.
- Technical agents: metadata/cover provider investigation, matching mechanics, validation implementation, and storage/privacy enforcement. No provider or implementation algorithm is selected by these product rules.
- No extra internal-space collapsing or arbitrary date limits are required by the product baseline. Preserve the supplied comparison reference and assess any additional requirements explicitly rather than inventing them.

## Implementation references

[task-02-books](../plans/task-02-books.md), [task-05-5-generated-titles](../plans/task-05-5-generated-titles.md). See the [global implementation plan](../plans/implementation-plan.md) for status and resume instructions.
