# Lending: interface design brief

Status: draft for Pen. Read [lending business rules](lending.md) first. Items marked proposed must be resolved or explicitly presented as alternatives; they are not approved behavior.

The selected design has now been exported in [the final handoff](../design/handoff-lending-final/HANDOFF.md). This brief records the requested coverage; it must not be read as a claim that all requested states were exported. See the handoff and [design guide](../design/README.md) for gaps and unresolved decisions.

## Context and visual direction

Extend the existing Media Collection v2 dark desktop interface, using [current design references](../design/README.md). Preserve restrained surfaces, portrait book covers, readable text, and existing typography/accent direction. Do not reuse reference covers as shipped application assets. Receiver names are labels entered by the library user, not accounts.

Required experiences: lend one or several books to one receiver, record one or several returns, and browse lent books with their receiver. Do not design due dates, overdue warnings, reminders, contact details, or extra statuses without approval.

Owners and Admin can lend and record returns. Guests can view loans and receivers but have no lending/return controls. Only Owned books without an active loan are eligible. Do not add business return-date fields.

Keep the existing bookcase/shelf assignment when lending. Prevent deletion or changing ownership to Not Owned while a book is lent, explaining that its loan must first be resolved. Multi-book lending/returns are all-or-nothing. Completed loans are retained, but a user-facing history view is not yet approved. No receiver-management page is needed initially; create/reuse receivers through lending.

## 1. Book details entry points

Required: a lending button on the book page opens the lending page with that book selected.

Proposed: when currently lent, show a visible 'Lent to [receiver]' indicator and a 'Record return' action instead of allowing another active loan. Keep ownership and reading status visually distinct from lending availability. Include the current receiver in the book panel, not just in the global loans page.

## 2. Lend books page

Required:

- Receiver Name field, visibly required.
- Use the same similarity-check experience as author and collection names. Similar matches offer an explicit choice to reuse an existing receiver or continue creating a distinct name. An identical name must reuse the existing receiver; it cannot create another record. With no match, confirmation creates a receiver.
- The starting book in a selected-books list, showing enough metadata to distinguish editions.
- A way to find and add other books to the same list; single-book lending remains equally straightforward.
- Review of receiver and selected books, confirm and cancel controls.

Proposed:

- Book picker searched by title, author, or ISBN; selected rows show cover, title, author, and edition/ISBN when available.
- Visible selection count and remove controls; allow removing extra books. Whether the starting book may be removed remains a design/business question.
- Unavailable books have an explanation: Not Owned or already lent.
- Primary action states the count, for example 'Lend 3 books'.

Show name validation, an empty selection, no picker matches, submitting, success, recoverable error, and an availability conflict. Preserve draft information after failure. Do not silently persist a receiver simply by typing a name.

## 3. Return books page

Required:

- Identify the receiver and preselect the starting book.
- Offer other books still lent to that receiver with per-book selection, including books lent on separate occasions.
- Confirm only the books actually handed back. Partial returns must be understandable.

Proposed: offer select-all/clear controls, show selected count, and use 'Record return of 2 books' as confirmation. Whether the starting book can be deselected is still open. No return date is entered.

Show one book, several books, a partial selection, none selected, submitting, success, error, and a book already returned by another user. Do not mark all books returned because one was selected.

## 4. Loans page

Required: list currently lent books and their receiver.

Proposed layout: group active loans by receiver, show a book count, expand individual books, link to book details, and offer return actions for one book or the receiver's group. An alternative flat list with receiver labels is acceptable if clearer. Search by receiver/title and lending dates depend on pending scope decisions. Returned-history access is also pending.

Show empty state ('No books currently lent'), loading, error/retry, one receiver, several receivers, long names/titles, and missing cover fallbacks. Guests see the same useful information without write controls.

## Interaction requirements

Use explicit labels, keyboard navigation, visible focus, non-color status indicators, and accessible feedback. A receiver can be a nickname; avoid requesting identity details. Do not equate receiver name with the logged-in user's username. Desktop browser and Electron normal business screens should behave alike. No mobile lending flow is approved yet.

## Copyable Pen task (after decisions are resolved)

Extend the Media Collection v2 designs with lending and returns. Read `docs/lending.md`, this brief, and `design/README.md`. Design the book-details lending entry point, a one-or-many-book lending page with a required receiver name, a return-selection page for books lent to that receiver, and a loans page identifying books and receivers. Reuse the established dark visual direction. Cover empty, validation, submitting, failure, conflict, and success states. Keep lending independent from ownership and reading status. Do not invent due dates, notifications, or receiver contact fields. Identify unresolved product decisions before treating a proposed interaction as final.
