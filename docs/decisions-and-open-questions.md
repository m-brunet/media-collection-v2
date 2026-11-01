# Product decisions and implementation handoff

Status: Tasks 1-7 are complete, with confirmed business rules and acceptance examples. This file keeps its existing path so earlier links remain valid. It is not a technical implementation plan or a claim that v2 is implemented.

## Authority and documentation map

Latest explicit user decisions take precedence, followed by the owning product documents below. Mockups supply visual direction only. The imported architecture documentation describes the foundation, not the v2 feature set; follow AGENTS.md and the required review skill for implementation.

| Product area | Current reference |
| --- | --- |
| Scope and exclusions | [Product scope](product-scope.md) |
| Feature and role overview | [Features](features.md) |
| Collections and shopping, Task 1 | [Collections](collections.md), [edition impacts](collection-editions-impact.md) |
| Book entry, lookup, personal notes, Task 2 | [Book entry](book-entry.md) |
| Locations, tags, search, ordering, Task 3 | [Locations, tags, search](locations-tags-search.md) |
| Lending and returns, Task 4 | [Lending](lending.md), [design brief](lending-design-brief.md) |
| Accounts and personal defaults, Task 5 | [Accounts](accounts.md) |
| Overview, Activity, mobile, Task 6 | [Overview, Activity, mobile](overview-activity-mobile.md) |
| Languages, offline use, backup/reset, Task 7 | [Release expectations](release-expectations.md) |
| Optional startup configuration direction | [Configuration](configuration.md) |
| Design inventory and discrepancies | [Design guide](../design/README.md) |

## Key boundaries

- MC v2 manages actual household books, not a general media catalogue. V1 is inspiration only; rare Not Owned planning must not dominate normal use.
- One shared library. Admin is the protected first user; later Guest/Owner roles are fixed at creation. No public signup, role upgrades/demotions, or Guest mobile access.
- Reading and optional notes are personal Owner/Admin features. Notes are author-only, including against other Owners/Admin. Guests have no reading-status/notes interface. Accounts are not linked to lending receivers.
- One record per edition, not multiple identical-edition copies. Valid ISBN-10 input converts to equivalent ISBN-13 and cannot bypass uniqueness. No-ISBN entry is explicit and possible duplicates warn without blocking.
- Collection completeness counts distinct covered volume numbers, not book records; consecutive omnibus coverage and overlap/conflict rules are explicit. Finished is manual and missing coverage reopens it. No books means no collection.
- Locations are precreated bookcases and shelves; books target a shelf only. Tags are independent reusable labels. Shared label changes follow identity, not duplicated strings.
- Loans change only loan state. Atomic operations, partial returns, retained history, lending dates/indicators, and receiver/title-only search are confirmed.
- Activity is distinct from technical audit storage: selected successful shared events, household-wide You wording, actual actor in timestamp details, no initial before/after or filters. Personal/security events do not appear.
- Desktop manual entry remains available; mobile is scan-gated. Mobile lookup gets one user-triggered Retry, then error/home without manual completion. Desktop failure fallback must not bypass mobile rules.
- Normal desktop browser/Electron business features match; pre-login host-local recovery and backup/restore are explicit exceptions, unavailable over HTTP or mobile.
- Restore is same-version only, including another computer, replaces all backed-up data/accounts/passwords, ends sessions, and preserves current data on failure. Admin recovery handles forgotten restored credentials.
- Authenticated Admin data reset is different: keep current Admin credentials, clear the agreed data/preferences, preserve separately saved backups, sign everyone out. No pre-login factory reset.

## Technical-agent responsibilities

Technical agents choose implementation mechanisms under the imported architecture/SOLID rules: storage and migrations, query mechanics, matching algorithms, providers, routing, validation enforcement, credential/session lifecycle, backup format/protection/validation, and local-maintenance boundaries. Honor the user-supplied identity/table direction where explicitly documented without treating illustrative alternatives as new requirements.

Ordinary business operations retain the foundation's HTTP boundary. The explicitly approved host-local maintenance actions require a restricted local path; they do not authorize an IPC business API or browser-accessible recovery/backup endpoints. Transport/deployment and update implementation need technical review, not additional product features inferred from a mockup.

Technical audits capture the agreed successful/failed use-case outcomes and before/after data without credential values. Preserve failed records independently of rolled-back changes and respect private-note visibility in any presentation. Raw technical-log viewers, automatic history purging, and extra administrative data access are not approved merely because Activity exists. Storage-growth/privacy handling must not silently discard required history or expose personal data.

## Design follow-up

Some original exports still contain superseded ratings, progress/goals, virtual shelves, and demo counts. The three-block entry form, physical locations/tags, current lending indicators/date/search, and mobile flows must follow current product docs. Missing mobile/account/loading/empty/error assets are design work, not unanswered authorization or ownership rules. Detailed component arrangement and feedback copy can evolve while preserving confirmed behavior.

## Explicit deferrals

Reading goals/in-progress Reading status, personal ratings, separate Lists, multiple collection membership, identical-edition copy management, nonconsecutive omnibus coverage, numbered treatment of specials, collection/tag/author merging, bulk planned-book generation, receiver management, returned-history UI, clickable visual bookcases, a separate desktop shopping-progression page, currency selection, scheduled backups, cross-version restoration, and a reusable v1 import interface are outside initial scope. V1 migration is likely a future one-off script using the retained MongoDB dumps.

The separate [MC update topic](updates.md) is complete with acceptance examples: stable GitHub Releases, pre-login local controls, Windows-only integrated installation, manual macOS/Linux installation with backup assistance, startup/manual checks, postponement, retained update backups, failure retries, and manual recovery. Only the Restart and install confirmation is required before Windows restart, without additional unsaved-work or remote advance warnings. Technical mechanisms remain delegated.

## Workflow and delivery sequence

Discuss one product topic at a time, record decisions/examples, and commit each completed task before asking the next task's questions. Working plans live in ignored .plans/. Pushing is separate from committing. Reopen an earlier product decision explicitly if a later choice changes it; do not silently replace it.

Agreed product delivery order: access/accountability with audit capture from first implemented changes; core manual library; organisation; lending/returns; assisted entry; mobile; Overview/Activity presentation. This is the agreed sequence, not a technical task breakdown. Product planning is complete for the initial seven topics; technical agents can now produce implementation plans from the owning references and acceptance examples.
