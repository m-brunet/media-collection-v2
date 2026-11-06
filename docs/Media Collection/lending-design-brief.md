# Lending: interface design brief

Status: design brief reconciled after Task 4 product closure. Read [lending business rules](lending.md) first. Items marked proposed remain visual options, not additional business requirements.

The lending screens are drawn in the Libris design artifact described in [design guidelines](design-guidelines.md). This brief records the required coverage; states not drawn there are built in the same style.

## Context and visual direction

Extend the Libris dark desktop interface, following [design guidelines](design-guidelines.md). Preserve restrained surfaces, portrait book covers, readable text, and existing typography/accent direction. Do not reuse reference covers as shipped application assets. Receiver names are labels entered by the library user, not accounts.

Required experiences: lend one or several books to one receiver, record one or several returns, and browse lent books with their receiver. Do not design due dates, overdue warnings, reminders, contact details, or extra statuses without approval.

Owners and Admin can lend and record returns. Guests can view loans and receivers but have no lending/return controls. Only Owned books without an active loan are eligible. Do not add business return-date fields.

Keep the existing bookcase/shelf assignment when lending. Lending changes only loan state, not ownership, reading, tags, membership, or collection completeness. Prevent deletion or changing ownership to Not Owned while lent, explaining that its loan must first be resolved. Multi-book lending/returns are all-or-nothing. Completed loans are retained, but their history view is future scope; show active loans initially. No receiver-management page is needed initially; create/reuse through lending.

## 1. Book details entry points

Required: a lending button on the book page opens the lending page with that book selected.

Required: when currently lent, show 'Lent to [receiver]' and the Record return action instead of allowing another active loan. Book listings show a compact Lent indicator. Keep ownership and reading status distinct from lending availability. Returning a book removes its active-loan indication.

## 2. Lend books page

Required:

- Receiver Name field, visibly required.
- Use the same similarity-check experience as author and collection names. Similar matches offer an explicit choice to reuse an existing receiver or continue creating a distinct name. An identical name must reuse the existing receiver; it cannot create another record. With no match, confirmation creates a receiver.
- The starting book in a selected-books list, showing enough metadata to distinguish editions.
- A way to find and add other books to the same list; single-book lending remains equally straightforward.
- Review of receiver and selected books, confirm and cancel controls.

Proposed:

- Book picker searched by title, author, or ISBN; selected rows show cover, title, author, and edition/ISBN when available.
- Visible selection count and remove controls; the starting book may also be removed. Require at least one selected book to confirm.
- Unavailable books have an explanation: Not Owned or already lent.
- Primary action states the count, for example 'Lend 3 books'.

Show name validation, an empty selection, no picker matches, submitting, success, recoverable error, and an availability conflict. Preserve draft information after failure. Do not silently persist a receiver simply by typing a name.

## 3. Return books page

Required:

- Identify the receiver and preselect the starting book.
- Offer other books still lent to that receiver with per-book selection, including books lent on separate occasions.
- Confirm only the books actually handed back. Partial returns must be understandable.

Proposed: offer select-all/clear controls, show selected count, and use 'Record return of 2 books' as confirmation. The starting book may be deselected; at least one book must remain selected to confirm. No return date is entered.

Show one book, several books, a partial selection, none selected, submitting, success, error, and a book already returned by another user. Do not mark all books returned because one was selected.

## 4. Loans page

Required: list currently lent books and their receiver.

Proposed layout: group active loans by receiver, show a book count, expand individual books, link to details, and offer return actions. Display lending dates. Search covers receiver name and book title only, not author or ISBN. Returned-history access is future scope, not part of the initial page.

Show empty state ('No books currently lent'), loading, error/retry, one receiver, several receivers, long names/titles, and missing cover fallbacks. Guests see the same useful information without write controls.

## Interaction requirements

Use explicit labels, keyboard navigation, visible focus, non-color status indicators, and accessible feedback. A receiver can be a nickname; avoid requesting identity details. Do not equate receiver name with the logged-in user's username. Desktop browser and Electron normal business screens should behave alike. No mobile lending flow is approved yet.
