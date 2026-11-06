# Task 5 — Lending and returns

Status: approved (2026-11-06), in progress on branch `feat/lending`. Global plan: [implementation plan](implementation-plan.md).
Owning docs: [lending](../lending.md) (authoritative rules, acceptance scenarios 1-20),
[lending-design-brief](../lending-design-brief.md), [features](../features.md) (Lending, permissions table), [overview-activity-mobile](../overview-activity-mobile.md) (dates in the
viewer's time zone, Activity grouping).
Design: `design/artifact/screens/` K1Sp0 (Lent books), pAfho (Loans empty), mwe4d (Lend books), K42ycP (Lend books,
name match + book picker), cclIx (empty selection), x2d8V (availability conflict), Njkmn (Record returns), iDevJ
(already-returned conflict), v9MipE (Book details, Lent), gRcO9 (Book details, Guest, Lent).

## Scope

In: receivers (create/reuse through lending only, name equivalence and similarity prompt); atomic multi-book lending
and returns with a removable starting book and partial returns; one active loan per Owned book; Lent books page
(active loans grouped by receiver, lending date, search by receiver name or book title); "Lent to …" on book details
and a Lent indicator in listings; delete / Not Owned blocked while lent; completed loans kept, also after the book is
deleted (former title/ISBN); per-book audit records sharing one operation ID, Failed records surviving rollback; EN/FR.
Out: returned-history UI, receiver management (rename/delete/merge), due dates/overdue/notes, mobile lending, Activity
presentation and Overview counter (Task 8), data reset (Task 9).

## Decisions (technical, within the specs)

- **New feature `lending`** owning receivers, loans, their pages and endpoints.
- **Persistence**: migration `009-lending`, UUID ids with the migration-006 CHECK:
  - `receivers` (`id`, `name`, `name_key` unique, `created_at`);
  - `loans` (`id`, `book_id` nullable FK `ON DELETE SET NULL` + index, `receiver_id` FK, `status` CHECK
    `lent|returned`, `lent_at`, `returned_at` nullable, `book_title`, `book_isbn` nullable).
  - Partial unique index `loans(book_id) WHERE status = 'lent'`: the database itself refuses a second active loan
    (double submission, two accounts at once). A new occurrence is a new row, so repeat loans never overwrite history.
  - `book_title` / `book_isbn` are written when lending and refreshed when the book is deleted, so a completed loan
    stays identifiable by the former title/ISBN (scenario 18) after `book_id` becomes null.
- **Domain**: `Receiver` (name rules shared with authors: 1-100 characters, `NameKey` equivalence, label kept as
  typed); `Loan` (`lend`, `markReturned`; returning a returned loan fails `loan-already-returned`); `LendingSelection`
  (non-empty, no duplicate books).
- **Receiver choice** like authors/collections: `{ id }` or `{ name, distinct? }`. Equivalent name → reuse; similar
  name without `distinct` → `409 receiver-similar` with candidates; otherwise created inside the lending transaction
  (a failed lend leaves no orphan receiver).
- **Books integration** (ports declared by `books`, implemented by `lending`, wired at the root like locations/tags):
  - `BookLoanReader.of(bookId)` → `{ loanId, receiverId, receiverName, lentAt } | null` for book details, list items,
    and the guards: deleting a lent book or saving it as Not Owned fails `409 book-lent`.
  - `LoanHistory.retain(book)` called by book deletion to store the former title/ISBN on its completed loans.
  - Lending reads the books it lends through its own read port (`LendableBooks`: id, title, ISBN, ownership), with a
    lending persistence adapter on the books table, as collections does.
- **Concurrency**: every check runs again inside the transaction; returns update only rows still `lent`, and a
  mismatch fails the whole batch (`loan-already-returned`, details: the books concerned). The unique index catches
  a race the checks miss and is mapped to `book-already-lent`.
- **Audit**: extend `AuditedOperation` with a batch form: one record per selected book, same operation ID, subject
  `book`/book ID. Categories `loan.lent` and `loan.returned`; after-state `{ loanId, receiver: { id, name }, status,
  lentAt[, returnedAt] }`. A receiver created by the lend is a related `receiver.created` record. On failure: one
  Failed record per selected book (no after-state), written after rollback. A request rejected at the HTTP boundary
  (empty list, duplicates, malformed ids) creates no audit record (it never reached a use case).
- **API**:
  - `GET /api/loans?search=&receiver=` → active loans grouped by receiver (name order), each loan with book
    (id, title, authors, edition details, ISBN, cover flag) and `lentAt`; totals (books, receivers). Search matches
    receiver name or book title only (case/accent-insensitive partial).
  - `GET /api/receivers?search=` → receiver name suggestions for the lend form.
  - `POST /api/loans` `{ receiver, bookIds }` → 201. Failures: `receiver-similar`, `book-missing`,
    `book-not-owned`, `book-already-lent` (details name the books, so the form can mark them).
  - `POST /api/loans/returns` `{ loanIds }` → 200. Failures: `loan-missing`, `loan-already-returned`,
    `loans-different-receivers` (user decision 1).
  - `GET /api/books` items and `GET /api/books/:id` gain `loan: { id, receiverId, receiverName, lentAt } | null`;
    the lend picker reuses `GET /api/books?search=` (title, author, ISBN) and marks Not Owned / already lent rows.
- **Permissions**: everyone signed in reads loans and receivers; Owners/Admin lend and return
  (`requireLibraryEditor`); Guests get `guest-read-only`.
- **Interface (Libris)**:
  - Sidebar **Loans** → `/loans` "Lent books" (K1Sp0): "5 books currently lent · 2 receivers", search, receiver
    groups with book count, rows with cover, title, "Lent 30 October 2026" (viewer time zone/language), Record return,
    View book details. Empty state (pAfho) with Browse books; no-result search state; Guests without Record return.
  - `/loans/lend?book=<id>` "Lend books" (mwe4d, K42ycP, cclIx, x2d8V): receiver name with suggestions and the
    similar-name choice (Use … / Create "…"), selected books with Remove (starting book included), Add other books
    picker, Handover summary, "Lend N books" disabled with "Select at least one book" when empty. On conflict the
    draft is kept, the offending books are marked, and the dialog explains nothing was lent. Leaving with a draft asks
    for confirmation (same mechanism as the book form). Success returns to the starting book (or Loans if it was
    removed) with a confirmation message.
  - `/loans/return?receiver=<id>&book=<id>` "Record returns" (Njkmn, iDevJ): receiver's active loans across occasions,
    starting book preselected, checkboxes with "Selected to return" / "Stays lent", select all / clear, Return summary,
    "Record N returns". Already-returned conflict keeps the selection and reloads the list.
  - **Book details** (v9MipE, gRcO9): "Lend" action for Owned, not lent books (Owners/Admin); when lent, a panel
    "Lent to Sam Taylor · Lent on …" with "Return this book before deleting it or changing it to Not Owned." and
    Record return replacing Lend; Delete stays visible but refuses with that explanation. Guests see the panel only.
  - **My books / collection details**: compact "Lent" chip (text, not colour alone).
  - **Book form**: if the book is lent, the Not Owned choice is disabled with the same explanation.

## Steps

0. [x] Slice 0 (user request): Obsidian vault in `docs/Media Collection/` holding the product docs and these plans
       (plans now committed instead of Git-ignored); references updated.
1. [ ] Domain: Receiver, Loan, LendingSelection; unit tests.
2. [ ] Persistence: migration 009 + SQLite tests (constraints, partial unique index, SET NULL on book deletion,
       upgrade of a populated database); receiver/loan repositories, active-loans query, lendable-books adapter.
3. [ ] Shared: batch form of `AuditedOperation` (per-subject Successful/Failed records, one operation ID); tests.
4. [ ] Application: lend, return, list active loans, find receivers; receiver resolver; books ports (loan reader,
       history) and the delete / Not Owned guards; book views; unit tests covering scenarios 1-15, 18-19.
5. [ ] HTTP: loans and receivers controllers, schemas, failure reasons; books payload changes; API e2e for every
       endpoint, roles, conflicts, rollback (no orphan receiver), audit records.
6. [ ] Libris: Lent books page, Lend and Record returns pages, book details panel and actions, Lent chips, form guard;
       EN/FR; component tests.
7. [ ] Browser e2e: lend one / several, similar-name choice, partial return across occasions, conflict keeps draft,
       delete blocked while lent, Guest view-only.
8. [ ] Docs (architecture: lending feature, ports, migration 009), full check, architecture review, commit, plan status.

## Decisions confirmed by the user (2026-11-06)

1. One return operation covers one receiver only: it may return several books, but the server refuses a request
   mixing loans of different receivers (`loans-different-receivers`).
2. Plan approved; slice 0 adds the Obsidian documentation vault as the branch's first commit.

## Notes for later tasks

- (filled in at the end of the task)
