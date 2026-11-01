# Book entry and assisted lookup

Status: Task 2 product decisions complete. This document records confirmed product behavior, not implementation choices. [Features](features.md) lists book fields; [collections](collections.md) defines coverage and ownership conflicts. Screen refinements and detailed mobile pages belong to Task 6.

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

## Failure and incomplete results

On desktop, if no book is found, an external service is unavailable, or the app encounters an error, preserve the entered ISBN and permit manual completion. Show clear feedback explaining the known problem. Do not silently fail or describe an application/service error as a successful search with no result. The interface need not expose internal implementation details or raw errors.

The manual-completion fallback above is desktop behavior. Task 6 explicitly restricts mobile: successful scan is required; failed lookup gets at most one retry, then error/Back to home and no manual fallback. A mobile existing Owned ISBN shows Already owned with scan-again/home options; an existing Not Owned ISBN requires confirmation before any external fetch and reuses the existing record. These mobile-specific decisions supersede the generic details redirect where applicable; see [mobile experience](overview-activity-mobile.md).

Populate empty fields from lookup while preserving manually entered values. If a result conflicts with a manually entered value, ask before replacing it. A lookup must not silently overwrite the draft.

Retain useful partial results and let the user complete missing information. Saving still requires all mandatory fields; an incomplete lookup does not waive those rules. Full publication dates are reduced to month/year as above. When several usable metadata results or covers are available, the user chooses the result/cover; do not arbitrarily select one. Existing manual values remain protected by the replacement-confirmation rule. Manual entry always remains available on desktop; mobile failure behavior follows Task 6.

## Form structure

1. Visible main block: mandatory information/statuses, category, collection-membership controls and required coverage when enabled, plus the optional cover preview/upload control. A missing cover uses a neutral fallback; cover controls are always visible inside this first block.
2. Visible organisation block: optional bookcase/shelf assignment and tags.
3. Collapsed Additional information: publisher, publication date, summary, page count, and price. An 'Add a personal note' button reveals the note field. If the user's note already exists, opening this section shows it directly instead of the Add button.

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
12. Lookup returns incomplete information or conflicts with a manual draft: keep useful data, ask before replacing conflicts, and require missing mandatory information before saving. Multiple usable results/covers require user choice.
13. Desktop lookup fails or finds nothing: preserve ISBN and manual completion, visibly explaining the known problem rather than silently failing. Mobile instead follows the scan gate and limited-retry/error-home rule confirmed in Task 6.
14. Desktop has no camera scanner. Mobile scanning fills ISBN; only pressing Find book starts lookup. No scanning or retrieval alone creates a book.

## Assigned follow-ups

- Task 5: account-role/deactivation changes and any effect on retained personal data; do not infer access to another user's note.
- Task 6: detailed mobile pages, scanner/error states, field-level feedback, similarity-warning layout, and conversion-icon explanation. Keep the confirmed form structure and explicit actions.
- Technical agents: metadata/cover provider investigation, matching mechanics, validation implementation, and storage/privacy enforcement. No provider or implementation algorithm is selected by these product rules.
- No extra internal-space collapsing or arbitrary date limits are required by the product baseline. Preserve the supplied comparison reference and assess any additional requirements explicitly rather than inventing them.
