# Lending and returns

Status: business-feature draft. Confirmed behavior comes from the product discussion. Recommendations and open decisions below are not approved requirements. No lending implementation exists yet.

## Purpose and terminology

Track which books have been lent, to whom, and which have been returned. Support several books handed to the same person or returned by that person in one operation, without requiring separate forms for every book.

- Receiver (borrower): the person receiving books. Stored independently from books and application accounts, with a name as the only user-entered field. The name is mandatory. No application account is created for the receiver.
- Loan: the association of a book with a receiver and a status indicating whether the book is still lent or has been returned.
- Lending form: one receiver and one or more books lent together.
- Return form: selection of books being returned by a receiver. Status is updated per book, so partial returns are possible.

Receiver names are an explicit exception to the earlier statement that no names are stored. They are not new real-name fields on user accounts. No email, address, phone number, or civility is requested for this feature.

## Confirmed flow: lend books

1. Start from a book page using a lending action.
2. Open a lending page with that book already included.
3. Require a receiver name.
4. Allow adding other books to the same lending operation. Additional books are optional; lending only the starting book is valid.
5. Show the chosen receiver and complete book list before confirmation.
6. Confirm the form to persist the receiver and loan associations for the selected books.

A receiver has its own table, and the loan associations reference book ID and receiver ID with a per-association status.

Use the same name-similarity mechanism as authors and collections. If no match is found, the entered name creates a receiver on confirmation. If similar names are found, ask the user to choose an existing receiver or continue with a distinct new name. Strictly identical receiver names cannot create separate records; reuse the existing receiver instead. Case, whitespace, and accent normalization still need definition. Similarity is advisory and must not silently select another person.

## Confirmed flow: record returns

1. Start a return operation for a book currently lent, normally using its book-detail return button. This starting book is preselected.
2. Identify its receiver.
3. Offer the other books currently lent to that receiver so the user can select books returned at the same time.
4. Confirm the selected books to change their loan statuses to returned.
5. Leave unselected books on loan.

Offer additional books based on their being currently lent to the same receiver, regardless of the lending occasion. Additional returns are optional. No business rule requires returning all books together. Whether the user can deselect the starting book still needs definition.

## Confirmed flow: see loans

Provide a dedicated page showing lent books and their receiver. The user must be able to answer 'Which books are lent, and who has them?' without opening each book.

Grouping by receiver, search, sorting, a returned-history view, entry points to return actions, and dates have not been specified. Receiver management is excluded from initial scope: create/reuse through lending only, with no dedicated rename/delete/merge interface. Keep receiver identity independent so management can be added later if needed. Suggested designs are in the [design brief](lending-design-brief.md).

## Relationship to existing concepts

Lending has its own state, rather than using tags, reading status, or collection membership to represent it. A receiver is not a library user and receives no permissions by being recorded.

Confirmed eligibility and permissions:

- Only Owned books can be lent.
- At most one active loan can exist for a book.
- Owners and Admin perform lending/returns; Guests view loans and receiver names without changing them.
- A lent book retains its normal bookcase/shelf assignment.
- Deleting a book or marking it Not Owned is blocked while it has an active loan; resolve the loan first.

Recommended rules awaiting confirmation:

- Lending does not change ownership; a lent volume remains owned for collection completeness and mobile shopping.
- Lending and returns do not change any user's reading status or the book's tags/collection membership.

## Dates, statuses, and history

Use Lent and Returned statuses. No business return date or due date is required, and the return form does not ask for dates. This is informal lending between friends, not a formal borrowing service. Technical audit timestamps still record lending and return actions. Whether to show a lending date from those events remains open. Overdue tracking, reminders, notes, and lost-book statuses are not approved scope.

Retain each completed loan as history and create a new loan occurrence when the same book is lent again, including to the same receiver. Do not overwrite earlier loans. A book/receiver pair alone cannot uniquely identify repeat loan occurrences. Whether to expose returned history in the initial interface remains open.

## Audit and Activity

Existing audit requirements apply to lending and returns: record actor, timestamp, category, Successful/Failed outcome, and before/after values as applicable, excluding credentials. Receiver identity and book associations must be traceable in the technical record.

Proposed Activity entries: 'alice lent 3 books to Sam' and 'alice recorded the return of 2 books from Sam'. Activity selects successful events from allowed categories and resolves the current acting username. The receiver is distinct from that actor. Whether receiver names appear in Activity, and whether batch actions appear as one event or individual book events, remain open.

Chosen technical audit granularity: one record per affected book/loan, linked by a common operation ID for a multi-book lending or return action. No parent audit event is required by this choice. Do not equate technical audit row count with Activity entry count; Activity may group related records. The actor, category, timestamp, and outcome remain available on each record.

If the atomic operation fails, no loan status changes persist; retain Failed audit records for the selected book/loan attempts with the same operation ID. Failure means the requested batch was not committed, not necessarily that every selected book independently violated a rule. Do not claim a persisted after-state or mark any item Successful after rollback. Failure audit records must survive the business transaction rollback. Exact failure payloads and handling failures before a book/loan can be identified remain planning details. The user's Activity wording still needs clarification before settling one entry per batch versus one per book and receiver-name display.

## Batch consistency

Lending or returning several selected books is all-or-nothing. If any selected book cannot be processed, none of the selected loans are changed. Failed attempts still follow technical auditing requirements. The batch boundary includes creation of a new receiver when needed; a failed lend must not leave an orphan receiver created only for that failed operation.

## Validation and reliability recommendations

These recommendations are not additional approved business rules:

- Reject blank/whitespace-only receiver names, duplicate books in one selection, and empty book selections.
- Recheck authorization and book availability on confirmation, not just in the picker.
- Preserve the draft and explain availability conflicts instead of reporting full success after an all-or-nothing operation fails.
- Prevent repeated submission from producing duplicate active loans or duplicate returns.
- Return only currently active loan associations; returned books should not be returned a second time accidentally.
- Canceling a draft should create neither a receiver nor loans. Offer correction and retry after failure without silently losing the selected books.

## Acceptance scenarios

Confirmed scenarios:

1. Starting from a book, entering a receiver name and confirming without adding another book records a single-book loan.
2. Starting from a book and adding others records a loan association for each selected book to the receiver.
3. Recording one returned book updates that book's loan status while leaving unselected books lent.
4. A return flow offers other books lent to the receiver for selection.
5. The loans page shows lent books and identifies their receivers.
6. A Not Owned book or an already-lent book cannot be lent again while in that state.
7. Selecting an existing receiver reuses that receiver; continuing after a similarity warning creates a distinct receiver only if its name is not strictly identical.
8. The return form preselects its starting book and offers other active loans to the same receiver, including separate lending occasions.
9. A Guest can view loans but cannot submit lending or return changes.

10. A failed multi-book confirmation does not leave a partially saved batch.
11. A later loan of a returned book preserves the earlier completed occurrence.
12. A currently lent book cannot be deleted or marked Not Owned.
13. Lending and returning a book preserve its assigned bookcase/shelf.

## Decisions needed before implementation planning

1. Roles are confirmed: Owners/Admin write, Guests view. Confirm whether lending leaves ownership, collection completeness, reading status, tags, and membership unchanged.
2. Owned-only lending and one active loan per book are confirmed. Define how eligibility conflicts are explained to the user.
3. Similarity-assisted receiver reuse/creation and no identical names are confirmed. Define name normalization. Receiver management is excluded initially; later additions must remain possible.
4. No due date or business return date is required. Should a lending date be displayed from the audit history, or should dates be absent from the initial loans interface?
5. Starting-book preselection and offering all active loans to the same receiver are confirmed. May the starting book be deselected or removed from the corresponding return/lending form?
6. Loan occurrences are retained. Should the initial UI show returned history or active loans only? Must it expose original lending batches?
7. Atomic confirmation and per-book/loan audit records linked by operation ID are accepted. Define failure payloads and persistence, including failures before identifiable book selections exist.
8. Deletion/Not Owned changes are blocked during active loans. After return, what happens to historical references when a book is deleted? No receiver-deletion UI is initially provided.
9. Shelf assignment is retained. Is 'lent' a filter/badge in My books and bookcase views?
10. Clarify 'one entry' in Activity: per user operation or per book? Confirm receiver-name display independently of audit granularity.
11. Is lending desktop/browser-only initially? Mobile's previously agreed purposes do not automatically include lending.

Full application reset deletes receivers and loan records along with the other library data.

## Implementation-planning handoff

The receiver table and loan-association concept are explicit user direction; table/column names and detailed schema are not prescribed. Plan within the existing pure hexagonal architecture and HTTP business boundary. Do not add business IPC.

Resolve the questions above before fixing migrations or API contracts. The future plan should cover lending, returns, active-loan queries, receiver selection, permission enforcement, validation/concurrency, audit integration, and history/deletion policy. Keep receiver identities separate from authenticated actors. Consider repeat occurrences before choosing association-table keys. No implementation tasks or migrations are authorized by this feature draft alone.
