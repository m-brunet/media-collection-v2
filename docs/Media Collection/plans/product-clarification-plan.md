# Product clarification plan

Working plan: local and intentionally ignored by Git. Confirmed decisions belong in versioned product documents. This plan covers business/product discussion only; technical agents choose implementation details separately.

## Agreed delivery order

1. Access and accountability: setup, roles, account management, recovery, and audit capture from the first implemented changes.
2. Core library: manual entry, edit/delete, ownership, personal reading status, simple search, sorting.
3. Organisation: collections, bookcases/shelves, tags, advanced filtering.
4. Lending and returns.
5. Assisted entry: ISBN metadata and cover lookup.
6. Mobile shopping and barcode scanning.
7. Overview and Activity presentation. Audit capture is already present from stage 1.

Each delivery includes its relevant empty/error/permission states. Deferring assisted-entry implementation does not defer discussion of its book-entry behavior. This is a product delivery sequence, not a technical implementation plan.

## Discussion process

- Work on one task at a time through back-and-forth discussion. Do not infer unanswered choices.
- Begin by reconciling already-confirmed decisions so they are not asked again.
- Ask focused questions in manageable batches, with practical examples and recommendations where useful.
- Record agreed answers in the owning versioned product documents as discussion progresses.
- Close a task only when user-visible initial-scope rules, meaningful edge cases, and acceptance examples are agreed and no blocking product ambiguity remains. Explicitly deferred features are acceptable; unanswered initial-scope behavior is not.
- Reconcile affected documents and design notes before marking done. Record any later-topic dependency rather than silently choosing its answer.
- Move to the next task after closure. Reopen an earlier task explicitly if a later decision changes its rules.
- Commit a completed task's documentation before starting the next task's questions. This is explicitly requested; do not accumulate several completed tasks uncommitted. Do not infer permission to push.
- Do not select schemas, libraries, APIs, or security mechanisms in this process; separate technical investigation from product decisions.

## Tasks

### 1. Collections and shopping ? done

Consolidated in [collections](../collections.md), with impact summary in [collection-editions-impact](../collection-editions-impact.md). Accepted: inferred missing range and deletion shrinkage; volume 0 safeguards; distinct-volume counting and consecutive omnibus ranges; explicit Finished/reopening; name-driven creation; rename updates and blocked collisions; no empty collections; duplicate-purchase coverage rules and explicit conflict resolution; compact mobile shopping and confirmation-based ordinary quick add.

Acceptance examples are recorded in [collections](../collections.md). No additional speculative Not Owned cases are required. Book-name matching is assigned to Task 2, lending interactions to Task 4, and exact screen refinements to Task 6. No automatic publication discovery requirement has been introduced. Merging, bulk planned-book generation, and a separate desktop shopping-progression page remain future scope.

### 2. Book entry, assisted lookup, and editions - done

Confirmed decisions and fourteen acceptance examples are consolidated in [book-entry](../book-entry.md). Covered ISBN input/conversion/provenance/uniqueness, explicit no-ISBN entry and duplicate warnings, optional cover, three form blocks, private Owner/Admin notes, no Guest personal reading/notes, shared-name reuse and author lifecycle, partial dates, EUR/null/free price distinction and fixed decimal display, pages, explicit lookup with existing-record redirect, draft protection, result choice, visible failures/manual fallback, and mobile-only scan handoff.

Role/deactivation implications belong to Task 5; exact screen/mobile/error layout belongs to Task 6. Technical agents choose providers, matching mechanics, storage, and enforcement. No pending initial-scope behavior is assigned to this task.

### 3. Locations, tags, search, and ordering - done

Consolidated in [locations-tags-search](../locations-tags-search.md) with fourteen acceptance examples. Covers bookcase/shelf creation and shelf-only assignment, labels/scoped uniqueness, rename/move checks, empty-location retention, deletion/unassignment confirmation, tag lifecycle, advanced fields and combinations, partial text/ISBN search, unassigned filters, book sort defaults/directions/null dates, name-only collection sorting, same-book matching, and whole-collection counts. Detailed screen/error-state layout is assigned to Task 6; technical agents choose implementation.

### 4. Lending follow-up - done

Consolidated in [lending](../lending.md) with twenty acceptance scenarios and reconciled design brief. Confirmed: lending-only state changes, ownership/collection independence, one active loan per Owned book, name-only normalized receivers, removable preselected starting book, atomic single/multi lending and partial returns, immutable shelf assignment during lending, retained repeated history/former title-ISBN after deletion, lending-date display, receiver/title-only active-loan search, Lent indicators, and grouped household-You Activity with per-book technical audits. Active-only UI initially; returned history and receiver management are future scope. Task 6 handles screen/error/layout refinements; technical agents choose mechanisms.

### 5. Accounts and personal reading status - done

Consolidated in [accounts](../accounts.md) with twelve acceptance examples. No signup, immediate first-Admin password setup, Admin-only later creation with fixed Guest/Owner choice, temporary password/change requirement for creation/reset, no self-deactivation or role changes, protected Admin, immediate deactivation session end, retained personal data/reactivation, inactive-name reservation and active-rename reuse, independent Not read defaults, and Guest restrictions are settled.

Reset clarification: pre-login Electron recovery preserves data; authenticated Admin-settings reset deletes other data/users but keeps Admin credentials. No pre-login factory reset or Admin deletion. Task 6 owns screen treatment; Task 7 owns reset confirmation/backup expectations. Commit this task before starting Task 6 questions.

### 6. Overview, Activity, and mobile experience - done

Consolidated in [overview-activity-mobile](../overview-activity-mobile.md) with fourteen acceptance examples and explicit screen reconciliation. Owned-only recent books/personal summaries; actual-data counters; eligible shared successful Activity, newest first/older access, household You, no filters or extra timestamp reveal interactions. Mobile Owner/Admin-only, Collections/Scan home, successful-scan gate, no manual ISBN bypass, same three form sections, explicit lookup/local existing-record check, confirmation before fetching for existing Not Owned, Already owned route, user-triggered single Retry then error/home and no manual fallback, draft protection and confirmed scan-again/home success are settled. Detailed missing visual assets are identified; designers/technical agents handle implementation without inventing flows. Commit before starting Task 7 questions.

### 7. Release expectations and final reconciliation - done

Consolidated in [release-expectations](../release-expectations.md) with eight acceptance examples; handoff index reconciled in [decisions-and-open-questions](../decisions-and-open-questions.md). Confirmed EN/FR per user plus pre-login detection/selector, offline desktop/reachable-host mobile, local Electron-only manual full-data backup/restore alongside recovery, preserved backed-up credentials, same-version portability to another computer, no merge, logout, failed-restore preservation, Admin reset password/confirmation with retained Admin/default preferences/logout and separately saved backups untouched. V1 migration future one-off; scheduled backups and broader restore compatibility future.

Commit Task 7 before starting separate update-system discussion. Existing product task docs and handoff references were reconciled, with technical/design work delegated rather than treated as undecided product rules.

## Progress

Next discussion after Task 7 commit: MC version-update system (requested separately; no implementation choices made).

- Delivery order and discussion workflow recorded.
- Task 1 is complete and its decisions are consolidated.
- Tasks 1-7 are complete. Commit Task 7 before update-system questions.
