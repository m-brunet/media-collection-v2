# Media Collection — global implementation plan

Created 2026-11-03. Working plan, kept with the documentation in the Obsidian vault (`docs/Media Collection/plans/`). This is the single place to resume implementation in a new thread.

## How to resume in a new thread

1. Read `AGENTS.md` (mandatory architecture/SOLID/validation rules and the required review skill), then this file.
2. Check the **Status** table below and `git log --oneline -15` to find the current task and whether it is planned, in progress, or done.
3. If the current task has a detailed plan (`plans/task-NN-*.md`), read it and continue from its own checklist. If not, write it first (see "Per-task workflow") and get user approval before implementing.
4. Before stopping, update the Status table and the task plan's checklist so the next thread can continue. Never leave work uncommitted between tasks without noting it here.

## Sources of truth

- Product rules: the vault root `docs/Media Collection/` (start with [product-scope](../product-scope.md), [features](../features.md), [decisions-and-open-questions](../decisions-and-open-questions.md)). Each task names its owning documents. Acceptance examples in those documents are test cases.
- Design: [design-guidelines](../design-guidelines.md). Local copy of the design artifact in Git-ignored `design/`; open `design/artifact/index.html`. Specs win over drawn screens; the design is a style/layout guide, not exhaustive or pixel-perfect; placeholder data/copy is not specified content.
- Architecture: `AGENTS.md`, [architecture](../architecture.md). Hexagonal NestJS backend, Kysely/SQLite, React web, Electron desktop, shared `packages/contracts`. Business operations over HTTP only; no business IPC. Host-local maintenance (recovery, backup/restore, updates) is the only Electron-local path.

## Key decisions already made (do not reopen silently)

- Names: product/installer/releases **Media Collection**; desktop web UI **Libris** (shown with "by Media Collection" underneath); mobile web UI **Leaf**.
- Libris at `/`, Leaf at `/leaf/`, same host and port, shared API. Default HTTP port 34345 (range 1024-65535).
- Minimum desktop size 1280 x 720. Fonts bundled locally (offline). Accessibility baseline in design guidelines.
- Icon sets: installation-wide Admin setting, Lucide default; alternative sets need credits page (CC BY).
- Timestamps stored UTC, displayed in viewer's time zone and language; exact details include zone label.
- Mobile existing Not Owned ISBN: confirm, then review existing record, no external lookup.
- Markdown excluded from oxfmt. `npm run check` builds before lint.

## Testing strategy (applies to every task)

Every task delivers tests at all relevant levels:

1. **Unit tests** (Vitest): domain entities/value objects and use cases with in-memory ports, covering the owning documents' acceptance examples.
2. **API end-to-end tests** (existing `tests/api` harness against the real runtime/SQLite): HTTP contracts, permission enforcement per role (Admin/Owner/Guest), validation errors, audit records.
3. **Frontend component tests** (to be introduced in Task 0: Vitest + Testing Library + jsdom): form behaviour, validation feedback, role-dependent controls, accessibility queries by role/label.
4. **Frontend end-to-end tests** (to be introduced in Task 0: Playwright driving a real built application in Chromium): main user journeys of each task for Libris (desktop viewport 1280x720 and 1440 wide) and Leaf (phone viewport), including Guest variants. Camera/barcode and external lookup are replaced by test doubles at the boundary.
5. Existing Electron desktop e2e (`tests/desktop`) stays for Electron-specific behaviour (window, recovery, maintenance).

Run all suites from PowerShell on Windows (the user's environment). `npm run check` must pass before a task is done.

## Per-task workflow

1. Write `plans/task-NN-<name>.md`: scope, owning docs, domain rules, persistence/migrations, API contracts, screens/states, audit events, test list mapped to acceptance examples, open questions. Ask the user to review.
2. Implement in small internal steps; keep `npm run check` green as often as possible.
3. Run the required architecture review skill from `AGENTS.md` on the changes.
4. Commit directly on `master` (one commit per task or a few logical commits); no feature branches or pull requests unless the user asks. Push only when the user asks.
5. Update the Status table.

## Tasks

Delivery order follows the agreed product sequence. Each task is a complete vertical feature: backend, API, Libris UI, EN/FR strings, audit integration, tests.

### Task 0 — Platform and UI foundation
Owning docs: `design-guidelines.md`, `product-scope.md` (foundation/access), `release-expectations.md` (languages), `configuration.md`.
- Rename package/app identity to Media Collection; Libris branding; default port 34345.
- Remove the foundation Notes demo feature.
- Design tokens, reusable components, Libris app shell (sidebar, routing), bundled fonts, Lucide icons through an icon abstraction (ready for set switching later).
- Minimum window 1280x720; accessibility baseline in components.
- EN/FR i18n infrastructure: pre-login device/browser language with selector, per-user saved preference (needs user table field), date/time formatting per language and viewer time zone.
- Leaf skeleton served at `/leaf/` (separate front-end bundle).
- Introduce frontend component tests and Playwright e2e tooling.

### Task 1 — Access and accountability
Owning docs: `accounts.md`, `features.md` (accounts, audit), `overview-activity-mobile.md` (Guest mobile denial).
- Technical audit log: category, Successful/Failed outcome, actor, timestamp, before/after without credentials, operation ID; failed records survive rollback.
- First-launch Admin setup form replacing the foundation's seeded `admin / p@ssw0rd`.
- Roles Admin (protected first user) / Owner / Guest, fixed at creation; create account with temporary password, reset password, deactivate/reactivate with session ending and username reservation, rename and released-name reuse.
- My account (username, password, language), sign out; server-side permission enforcement; permission-denied page; Guest denied on Leaf.
- Existing local Admin recovery kept working.

### Task 1b — Appearance: colour schemes
Inserted at the user's request (2026-11-04). Owning doc: `design-guidelines.md`; source `design/color-charts.html`.
- Installation-wide colour scheme (Mint, Emerald, Forest, Spring green; default Spring green) chosen by the Admin, applied to Libris and Leaf including before sign-in. Task 10 adds the icon set to the same Appearance page.

### Task 2 — Books (core library)
Owning docs: `features.md` (books), `book-entry.md`, `collection-editions-impact.md`.
- Book record and all fields with validation; ISBN-10/13 validation, conversion and uniqueness; no-ISBN with overridable duplicate warning.
- Shared authors with exact reuse and similar-name prompt; author correction/deletion rules.
- Covers (upload, fallback), category, ownership, per-user reading status (new users/books start Not read), private per-user note.
- Three-section form, book details (ISBN conversion indicator), deletion, My books list with simple search and sorting, discard confirmation, save failure keeps draft.
- If it grows too large, split into "records and rules" and "screens".

### Task 3 — Collections
Owning docs: `collections.md`, `collection-editions-impact.md`.
- Membership, single/omnibus coverage, volume 0, expected range, inferred/missing, Finished/reopen, overlap rules and conflict resolutions, rename/delete, auto-removal of empty collections.
- Collection list (name sort, search) and detail page with expandable volume entries.

### Task 4 — Locations, tags and advanced search
Owning docs: `locations-tags-search.md`, `features.md`.
- Bookcases/shelves with naming, move and deletion rules; shelf assignment in the book form.
- Tags management page and inline creation; deletion/rename rules.
- Advanced filters (all fields, AND/OR, tag include/exclude, No location/No collection), applied to books and collection listing (single-book match rule, whole-collection counts).

### Task 5 — Lending and returns
Owning docs: `lending.md`, `lending-design-brief.md`.
- Receivers with name matching; atomic multi-book lend/return, partial returns, preselected removable starting book.
- Loans page grouped by receiver with search, lending dates, lent indicators; delete/Not Owned blocked while lent; history retained incl. after book deletion; per-book audit with operation ID.

### Task 5.5 — Generated titles for collection Manga and Comics
Inserted at the user's request (2026-11-06). Owning docs: `book-entry.md` (title generation and editing), `features.md` (Books), `collections.md` (rename/delete effects). Detailed plan: [task-05-5-generated-titles](task-05-5-generated-titles.md).
- Keep a mandatory stored title; allow blank title input only for Manga/Comics with collection membership. Generate `Collection name Vol. N` or `Collection name Vol. N–M` in the backend (format changed from `Name - N` by the user, 2026-11-06).
- Persist `titleGenerated`; update generated titles on collection rename, membership move and coverage changes; preserve supplied titles. Existing V2 records default to false without changing their titles.
- Individual removal of membership or category change to Books requires a supplied title, prefilled with the last generated title so one confirmation can keep it. Collection deletion preserves the last generated title and clears the flag automatically.
- Update domain/application rules, persistence, HTTP contracts, Libris EN/FR form feedback, search/sort, audit and tests; check completed lending integration. Tasks 6 and 7 inherit these rules.
- V1 import, dump corrections and migration scheduling are excluded.

### Task 5.8 — Test entity builders
Inserted at the user's request (2026-11-06), after Task 5's review. Plan: [task-05-8-test-builders](task-05-8-test-builders.md).
- Fluent builders (`with…`, `as…`) for domain entities, saved through repository ports so one builder serves unit
  and API tests; a cross-feature `TestLibrary` entry point; replace the duplicated lending test helpers.

### Task 6 — Assisted entry (desktop)
Owning docs: `book-entry.md`.
- **Step 1, own commit (decided 2026-11-06):** remove shop padding from covers when they are saved (upload, V1 import,
  and later lookup results), by the deterministic rule in [book entry · Cover padding](../book-entry.md#cover-padding).
  Needs a server image library (proposed: `sharp`; check native packaging like `better-sqlite3`, and JPEG/PNG/WebP
  support). Behind a books driven port; unit tests on the rule, API test on upload, check on the V1 import; then
  re-run `npm run dev:import-v1` to clean the development covers. Found while bringing Collections back to the design
  ([design-fix-collections](design-fix-collections.md)).
- Select metadata/cover provider (research, licensing, offline failure), integrate behind a port.
- Find book flow: library check first, redirect if existing, result/cover choice, replacement confirmation, failure/no-result feedback with manual completion.

### Task 7 — Leaf (mobile)
Owning docs: `overview-activity-mobile.md`, `collections.md` (shopping), `book-entry.md`.
- Mobile home, unfinished-collection shopping, confirmed mark-Owned quick add.
- Barcode scanning, scan-gated add form, existing Owned/Not Owned branches, single user-triggered retry, success/failure screens.

### Task 8 — Overview and Activity
Owning docs: `overview-activity-mobile.md`, `features.md` (Activity, Overview).
- Overview counters, recently added, personal reading summary (none for Guests).
- Activity projection from audit: eligible successful shared events, grouped lending operations, household "You" wording, relative time, exact details on hover/focus, load older.

### Task 9 — Host maintenance and data safety
Owning docs: `release-expectations.md`, `accounts.md`, `features.md` (recovery, data reset).
- Local Electron maintenance window (pre-login): Admin recovery, full backup create/restore (same version, replace, end sessions, reject invalid/other versions, preserve data on failure).
- Authenticated Admin data reset with password confirmation.

### Task 10 — Release readiness
Owning docs: `updates.md`, `design-guidelines.md`.
- GitHub Releases update checks, Windows integrated download/install with automatic backup, macOS/Linux backup-and-open-download-page, backup folder, failure handling.
- Packaging/installer naming; icon set switching (Admin setting) and credits/licences page.

## Dependencies

0 → 1 → 2 → 3 → 4; 5 needs 2; 5.5 follows 5 and needs 2-3; 5.8 follows 5.5; 6 follows 5.8; 7 needs 3, 5.5 and 6; 8 needs 1-5.5; 9 needs all data tasks; 10 needs 9.

## Future development data commands (outside Task 5.5)

Reserve repository-root `local-imports/` for local source dumps, ISBN/category corrections and import reports. The
entire directory is Git-ignored; for example, the V1 source can live at `local-imports/v1/books.json`. No real dump or
personal-data fixture belongs in version control. This is source material, separate from `.dev-data/` runtime storage:
resetting development data must not delete the import inputs. Create the directory locally as needed; Git does not
track empty directories.

Implemented on 2026-11-06 as `npm run dev:reset-data` and `npm run dev:import-v1`; see
[dev-data-commands.md](dev-data-commands.md) and the README.

## Status

| Task | Status | Detailed plan | Notes |
| --- | --- | --- | --- |
| 0 Platform and UI foundation | Done (2026-11-03) | `task-00-platform-ui-foundation.md` | Committed; see its notes for later tasks |
| 1 Access and accountability | Done (2026-11-04) | `task-01-access-accountability.md` | Committed; see its notes for later tasks |
| 1b Appearance: colour schemes | Done (2026-11-04) | `task-01b-appearance-color-schemes.md` | Inserted at the user's request |
| 2 Books | Done (2026-11-04) | `task-02-books.md` | Committed; see its notes for later tasks |
| UUID keys and Kysely SQL rules | Done (2026-11-05) | `uuid-primary-keys-and-kysely-rules.md` | Done by the user after Task 2 (PR #1); reviewed, full check passes |
| 3 Collections | Done (2026-11-05) | `task-03-collections.md` | Committed; see its notes for later tasks |
| 4 Locations, tags, search | Done (2026-11-05) | `task-04-locations-tags-search.md` | Committed; see its notes for later tasks |
| 5 Lending | Done (2026-11-06) | [task-05-lending](task-05-lending.md) | Committed; slice 0 = documentation vault; see its notes for later tasks |
| 5.5 Generated titles | Done (2026-11-06) | [task-05-5-generated-titles](task-05-5-generated-titles.md) | Committed; see its notes for later tasks |
| 5.8 Test entity builders | Done (2026-11-06) | [task-05-8-test-builders](task-05-8-test-builders.md) | Committed; see its notes for later tasks |
| Design fix: Collections pages | Done (2026-11-06) | [design-fix-collections](design-fix-collections.md) | Inserted at the user's request; see its notes |
| 6 Assisted entry | Not started | — | Step 1 decided: cover padding removal (own commit) |
| 7 Leaf (mobile) | Not started | — | |
| 8 Overview and Activity | Not started | — | |
| 9 Host maintenance | Not started | — | |
| 10 Release readiness | Not started | — | |

Pre-implementation fixes done (2026-11-03): docs/design decisions recorded, foundation formatted with oxfmt, `whoami`/`icacls` resolved from System32, `npm run check` order fixed. Full check passes (41 files, 409 tests).
