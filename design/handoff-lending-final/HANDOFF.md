# Media Collection v2 — Design handoff

**Status:** One final design direction for review. This package contains design artifacts only; no application implementation code.

## Contents and reopening

- `media-collection-v2-final.pen` — latest saved editable Pen document, including the existing library screens and the five selected lending/return screens in one block.
- `assets/covers/` — mockup cover images referenced by the native document and HTML export. Keep this directory beside the `.pen` file; its relative asset references resolve from `assets/covers/`.
- `screens/` — individually named PNG exports, exported from the same final document at the editor’s default 2× scale.
- `visual-reference.html` — HTML/CSS visual reference exported from the same screen nodes. It references `assets/covers/` relatively. Open it in a browser with the assets directory in place.

All cover images are **design-review mockups only**. They are not approved application assets, sample data, or production content.

## Screen inventory

| # | Screen | Export | Scope |
|---|---|---|---|
| 01 | My books — finished cover grid | `screens/01-my-books.png` | Existing library page |
| 02 | Overview | `screens/02-overview.png` | Existing library page |
| 03 | Shelves — desktop | `screens/03-shelves.png` | Existing library page |
| 04 | Activity | `screens/04-activity.png` | Existing library page; not redesigned for lending |
| 05 | Collections — series overview | `screens/05-collections.png` | Existing library page |
| 06 | Collection — Batman details | `screens/06-collection-batman.png` | Existing collection detail |
| 07 | Book details — lend or return | `screens/07-book-details-lend-return.png` | **New/changed:** eligible and currently lent detail states; entry actions |
| 08 | Lend form — single book | `screens/08-lend-single-book.png` | **New:** required receiver name; starting book preselected; direct confirmation; lending one book is valid |
| 09 | Lend form — multi-book and name match | `screens/09-lend-multi-book-name-match.png` | **New:** optional additional books and explicit similar-name reuse/create choice |
| 10 | Lent books — grouped by receiver | `screens/10-loans-grouped-by-receiver.png` | **New:** active loans, receiver identity, and return entry points |
| 11 | Return form — partial selection | `screens/11-return-partial-selection.png` | **New:** starting book selected, other active loans to that receiver offered, partial return confirmed together |

## Lending and return interactions

1. **Start from book details.** An eligible Owned, not-currently-lent book offers **Lend this book**. A currently lent book identifies its receiver and offers **Record return** instead. A lent book cannot be deleted or changed to Not Owned until its loan is resolved. Lending preserves its normal shelf assignment.
2. **Lend on one form.** The starting book is already selected. A receiver name is mandatory. Additional eligible books are optional; the user can lend only the starting book or add more books for the same receiver. Only Owned books without an active loan are eligible.
3. **Resolve receiver similarity explicitly.** Similar names offer an explicit choice to reuse the existing receiver or create a distinct receiver. Similarity never silently changes the selected identity. A strictly identical name cannot create a duplicate receiver. The receiver is only persisted with a successful lending operation.
4. **Confirm directly.** The **Lend books** action confirms the selected receiver and complete book set from the form; there is no separate review page. The batch is all-or-nothing. The layout does not depict a separate feedback screen.
5. **Browse active loans.** The loans page groups current loans by receiver and identifies the books each person has. Guests may view loan information but cannot lend or record returns; write actions are for Owners/Admin.
6. **Record a partial or multi-book return.** Start from a lent book’s return action. That book is preselected. The form offers every other active loan to the same receiver, including books lent on separate occasions. Select only the books actually returned and confirm the selected set together; unselected books remain lent. There are no due-date or return-date inputs.

## Open questions and design boundaries

These are not settled by this proposal and must not be inferred as approved product requirements:

- Receiver-name normalization: treatment of case, surrounding/repeated whitespace, and accents is undecided. Exact identical names must reuse the existing receiver.
- Whether the starting book can be removed/deselected in lending or return is undecided. The selected designs keep it selected.
- The business draft recommends lending does not change ownership, collection completeness, reading status, tags, or collection membership; this still needs confirmation.
- Lending-date display, returned-history UI, and original lending-batch visibility remain unapproved. This proposal shows active loans only and no dates/history controls.
- Activity wording/grouping and whether receiver names appear in Activity remain unresolved. Activity is intentionally unchanged here.
- A dedicated loan filter/badge in My books or bookcase views and historical-loan behavior after book deletion remain undecided.
- The selected five lending screens do not include a dedicated Guest-state screenshot or separate loading, validation, conflict, error, and success screens. Permission rules and atomic operations remain requirements; the final visual set is intentionally minimal and does not imply those rules are waived.
- The designs use review covers, not production assets. Do not package or seed them into the application.

## Source requirements

Prepared against the supplied `docs/lending.md`, `docs/lending-design-brief.md`, and `design/README.md`, with the v2 product scope and feature documents as context. Where the visuals are silent or the documents identify an open decision, the written requirements and unresolved status take precedence.
