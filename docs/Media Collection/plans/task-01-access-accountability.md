# Task 1 — Access and accountability

Status: done (2026-11-04). Global plan: [implementation plan](implementation-plan.md).
Owning docs: [accounts](../product/accounts.md), [features](../product/features.md) (accounts/permissions, audit logs), [overview-activity-mobile](../product/overview-activity-mobile.md) (Guest mobile denial), [product-scope](../product/product-scope.md).

## Goal

Real access model and technical audit trail, used by every later task: first-launch Admin setup, fixed Admin/Owner/Guest roles, account lifecycle, server-side permissions, and an audit record (Successful or Failed) for every user-initiated state change.

## Decisions

### Roles and accounts
- Roles `admin` (exactly one: the protected first user), `owner`, `guest`. Fixed at creation; no role-change operation exists.
- Migration `003-access-and-audit`: role `user` → `owner`; if several foundation admins exist, the earliest-created stays `admin`, the others become `owner`; add `users.active` (1); create `audit_logs`.
- Admin creates Owner or Guest accounts with a temporary password; resets other accounts' passwords (temporary again); deactivates/reactivates other accounts. The protected Admin is never a target of these operations and cannot deactivate itself.
- Deactivation ends sessions immediately (token version bump + active check on every request) and blocks sign-in with the same message as wrong credentials. The record and its username stay (username reserved). Reactivation restores the same role and data.
- Active rename releases the old name (already natural: usernames are stored once).

### First-launch setup
- The foundation's seeded `admin / p@ssw0rd` is removed. With no users, `GET /api/setup` reports setup required and Libris shows "Set up your library" (username, password, confirmation). `POST /api/setup` creates the protected Admin with a chosen (not temporary) password and signs in.
- Setup is accepted only in the Electron desktop window (user decision, 2026-11-04), not from any browser, even on the same computer. Electron creates a random secret per launch, passes it to the backend, and attaches it only to its own window's `/api/setup` requests. Creation is atomic: it only succeeds while no user exists.

### Permissions
- `ActorAuthorization`: `requireReady`, `requireAdmin`, `requireLibraryEditor` (Owner/Admin; used from Task 2), `requireLeafAccess` concept handled in the UI (Leaf shows Guest denial; mobile-only endpoints in Task 7 require Owner/Admin).
- Libris: Administration only for Admin; a direct link to an admin page shows the permission-denied page. Leaf: Guests see "Owner or Admin required" with sign-out.

### Transactions and audit
- New shared driven ports: `TransactionRunner` (run work atomically) and `AuditTrail` (record entries). Kysely adapters: `DatabaseConnections` (AsyncLocalStorage holds the current transaction; repositories always ask it for the connection) and `KyselyAuditTrail`.
- Application service `AuditedOperation`: runs a use case's state change inside a transaction and records the Successful entry in the same transaction; on failure the transaction rolls back and a Failed entry is recorded afterwards, outside it, then the error is rethrown. Failed entries never carry an after-state.
- Audit entry: operation id, category, outcome, actor id (nullable for unknown sign-in), timestamp, subject type/id, before/after JSON, failure code. Credentials are never included: use cases pass explicit safe snapshots and the adapter additionally strips any key that looks like a secret (password, hash, token, key, chain, secret).
- Categories in this task: `setup.administrator-created`, `account.created`, `account.password-reset`, `account.deactivated`, `account.reactivated`, `account.renamed`, `account.password-changed`, `account.language-changed`, `account.recovered` (local recovery), `authentication.signed-in` (technical; never shown in Activity), `server-settings.http-changed`, `server-settings.https-changed`. Issue #20 adds `authentication.pairing-code-created` and `authentication.signed-in-with-pairing-code` (technical; never shown in Activity, the code itself is never recorded).

### Error reasons (translation)
- `Failure` gains an optional stable `reason` (e.g. `username-taken`, `password-incorrect`, `protected-administrator`, `setup-completed`, `setup-local-only`), returned as `reason` in HTTP errors. The UI translates reasons; it keeps generic messages by code as fallback. Later tasks use the same pattern.

### Interface
- Libris: setup page; temporary-password page (existing); My account shows the role with its explanation; User management (design `MMmMx`): protected Admin card, accounts table with role/status and actions, Create account dialog (Owner/Guest required choice, no default), Reset password dialog, Deactivate/Reactivate confirmations; permission-denied page.
- Leaf: setup-required notice, Guest denial page.
- Sign-in hint about `admin / p@ssw0rd` removed.

## Steps
1. [x] Failure reasons; roles/active in domain; migration 003; repository changes.
2. [x] Transaction runner, connection provider, audit trail adapter, `AuditedOperation`; adapter tests on real SQLite.
3. [x] Use cases: setup (status + create), create account (owner/guest), reset password, deactivate, reactivate, list; audit existing use cases (login, rename, password, language, settings, recovery); remove seed.
4. [x] HTTP: setup controller endpoints (loopback check), user lifecycle endpoints, reasons in failure filter; API e2e for every endpoint.
5. [x] Test infrastructure: fixtures/helpers use setup instead of seeded admin (API runtime, desktop, packaged smoke, browser).
6. [x] Libris and Leaf screens, EN/FR; component tests.
7. [x] Browser e2e journeys: first launch, Admin creates Owner and Guest, Guest read-only + permission page, deactivation, Leaf Guest denial.
8. [x] Docs (README sign-in instructions, accounts/architecture notes), full check, architecture review, commit, plan status.

## Outcome and notes for later tasks

- Every state-changing use case wraps its change in `AuditedOperation.run(context, change)` (shared/application/services). Return `{ result, before, after }` with credential-free snapshots; set `context.subjectId`/`actorId` inside the change when only known there. Multi-record operations (lending batches) record one entry per affected record with the same operation id: extend `AuditedOperation` for that in Task 5 rather than calling `AuditTrail` directly.
- Repositories must take `DatabaseConnections` and always use `connections.current`, so they join the operation's transaction.
- Permissions: `ActorAuthorization.requireLibraryEditor(actor)` for every shared-library change from Task 2 on (Owners and Admin; Guests get `guest-read-only`).
- Failures carry a stable `reason`; add new reasons to `ApiErrorMessage.reasons` in the web app with EN/FR texts (`reason.*`).
- Account administration lives in `AccountsController` (`/api/users`), first launch in `SetupController` (`/api/setup`, desktop window only: `SetupAccess` checks the per-launch secret that `SetupRequestSigner` in Electron attaches; test backends use `test-setup-token`, sent by `desktopWindow` in `tests/api/client.ts`).
- Test helpers: `administrator(client)` in `tests/api/runtime-setup.ts` now completes setup (user `admin` / `administrator-new-password`); `TestApp.requirePasswordReplacement(fixture)`; `app.dependencies.audit` reads audit records; web `FakeApi.firstLaunch(local)`.
- Not done here (deliberately): local Admin recovery is not audited yet. The recovery entry point opens the database without migrating, so it cannot rely on the audit table; Task 9 rebuilds recovery and adds its audit record.
- Full `npm run check` from PowerShell: 57 test files, 534 tests.
