# Task 9 — Host maintenance and data safety

Status: plan written 2026-11-08, questions answered, waiting for the user's approval. Branch `task-09-host-maintenance`.

Owning docs: [release expectations](../operations/release-expectations.md) (backup and restore, Admin data reset,
acceptance examples 3 to 8), [accounts](../product/accounts.md) (local recovery, data reset, examples 11 and 12),
[features](../product/features.md) (local administrator recovery, data reset), [updates](../operations/updates.md)
(Task 10 reuses the backup and the backup folder), [design guidelines](../design/design-guidelines.md) (colour scheme and
icon set are saved preferences: in backups, back to defaults after a reset). Design screen `iX066` (Accounts page with
the "Application data reset" dialog).

## Scope

1. **Local maintenance window** in Electron, before sign-in, with no HTTP route: Admin recovery, Create backup,
   Restore backup. It replaces today's recovery window (`--reset-admin --login <name>`).
2. **Authenticated Admin data reset** in Libris (Administration → Accounts), with the current password and an explicit
   confirmation.

Out of scope: scheduled or automatic backups (Task 10 adds the update-time backup and "Open backup folder"),
cross-version restore, V1 import UI, factory reset before sign-in, Admin deletion, KI-1 to KI-6.

## Rules (from the owning docs)

- Maintenance trusts the host OS account: no MC account, no recovery key. Browsers and Leaf have no equivalent
  (no endpoint, including localhost).
- **Recovery** shows the protected Admin's username, sets a new password (temporary: replaced at next sign-in), ends
  the Admin's sessions and keeps all data.
- **Backup** is the full application data: books and covers, authors, collections, locations, tags, users (with
  password hashes), reading statuses, private notes, receivers, loans, audit history, saved application settings.
- **Restore** only from a backup made by the **same MC version** (also on another computer), after explicit
  confirmation. It replaces the current data (no merge), keeps the backed-up accounts and passwords (no forced new
  Admin password), ends every session. Invalid, damaged or other-version files are rejected clearly; any failure keeps
  the current data unchanged.
- **Data reset** (protected Admin only, current password + explicit confirmation): deletes books, authors, covers,
  collections, locations, tags, receivers, loans, reading statuses, notes, audit/Activity history, other users and
  saved application preferences (colour scheme back to Spring green). Keeps the Admin's username and password. Ends
  every session and returns to sign-in. Never touches backup files or the external override file. Guests and Owners
  are refused.

## Decisions (answers of 2026-11-08 below)

### Opening the maintenance window

- Proposed: a native application menu **Maintenance → Open local maintenance…** in the desktop window, always present
  (the Libris window may be on the sign-in page or signed in). Choosing it asks for confirmation ("The server stops
  while maintenance is open: browsers and phones lose access until you close it"), stops the backend, closes the
  Libris window and opens the maintenance window. Closing the maintenance window starts the backend and the Libris
  window again (on the sign-in page after a restore).
- A launch option **`--maintenance`** opens the same window without starting the server, for when the application
  cannot start (for example after a failed update, Task 10). It replaces `--reset-admin --login`, and `npm run
  reset-admin` becomes `npm run maintenance`. The Admin's username now comes from the database, so `--login` goes.
- Maintenance and the normal application never use the data at the same time: the menu path stops the server first;
  the launch option keeps the existing single-instance lock.

### Maintenance window

- Plain local page (no web build, no server), like today's recovery page, Spring green, bundled fonts, EN/FR following
  the system language (Electron `app.getLocale()`) with a selector.
- Layout: brand header "Media Collection · Local maintenance", then three sections on one page: **Recover Admin
  access** (Admin username shown, new temporary password + repeat), **Create backup** (button, then a save dialog),
  **Restore backup** (choose a file, then a summary — backup date, MC version, counts of books and accounts — and a
  confirmation checkbox "I understand the current data is replaced" before **Restore and end all sessions**). Status
  messages in a live region. Window about 560 × 720.
- First launch with no data: recovery is unavailable ("No Admin account yet"), backup is unavailable (nothing to save),
  restore works (moving to a new computer).
- IPC stays narrow: one preload bridge `maintenance` with `status()`, `recover(password)`, `createBackup()`,
  `chooseBackup()` and `restoreBackup(token)`; file paths come only from native dialogs in the main process, never from
  the page. Every handler checks the sender frame as today.

### Backup file

- One file, extension **`.mcbackup`**, a ZIP archive (library `fflate`, MIT, pure JavaScript, no native build):
  - `manifest.json`: `format: 1`, `application: "Media Collection"`, `version` (the MC version), `createdAt` (UTC),
    counts (books, accounts), and the SHA-256 of every other entry;
  - `application.sqlite`: the database copied after the backend has closed it (no WAL left, consistent);
  - `covers/<file>`: every stored cover file;
  - `tls/<folder>/chain.pem` and `key.pem`: the saved HTTPS certificate, when there is one.
- Not included: `session.key` (machine secret; a new one is made at restore), `electron-profile/`, the override file.
- The file name carries the local date and time (user, 2026-11-08): `Media Collection backup 2026-11-08 14-30-05.mcbackup`
  (seconds avoid two backups of the same minute sharing a name). Default folder `Documents/Media Collection
  backups` (created when needed; Task 10 uses the same folder for update backups). The save dialog lets the person
  choose another place. Written to a temporary name, then renamed, so a failed backup leaves no partial file. File
  restricted to the current OS account (like `session.key`).
- Not encrypted: it contains password hashes and private notes, so the window says "Keep this file private". Encryption
  with a backup password can come later.

### Restore

1. Read and check the file in a staging folder inside the data directory: ZIP readable, manifest present and valid,
   same application, same version, every checksum matches, cover names valid, database opens, its migrations are
   exactly the current ones, a protected Admin exists, every referenced cover is present.
2. Swap: move the current `application.sqlite` (with `-wal`/`-shm`) and `covers/` aside, move the staged ones in.
   On any error, move the previous ones back. Then write a new `session.key` (ends every session, including sessions
   whose token version matches the backup), write the restore audit record into the restored database, delete the set
   aside data.
3. Rejections name the reason: "not a Media Collection backup", "damaged backup", "made by version X, this is version
   Y".

### Data reset

- `POST /api/maintenance/data-reset` with `{ password }`; protected Admin only (`403` for Owner and Guest, `401`
  signed out, `400 password-incorrect`, CSRF as every write). `204`, session cookie cleared, every token version
  increased; the Libris page goes to sign-in.
- One transaction: loans before receivers (no cascade on `loans.receiver_id`), the library tables, audit records,
  other users, saved preferences (`appearance`); then cover files nothing refers to are removed. Rows are deleted,
  tables never dropped.
- Kept by the reset (user, 2026-11-08): the HTTP port, the HTTPS settings with their certificate files, and the Admin's
  language (host and network setup, and part of the account). Only the colour scheme returns to its default (and the
  icon set, when Task 10 adds it). The backup includes all of them, the HTTPS certificate files too (`tls/`).
- Reuse: the development reset's `KyselyLibraryEraser` and `KyselyCoverFileCleanup` move into the new `maintenance`
  feature as the shared implementation; the development command is composed with them (root config), so the two
  resets cannot drift. The product reset adds the users and preferences erasure.
- Libris: an "Application data reset" panel at the bottom of Accounts (design `iX066`) with a **Reset application
  data** button, opening the dialog: text listing what is erased and kept, Current Admin password, checkbox "I
  understand this cannot be undone", **Reset data and sign out** (disabled until both are filled) and Cancel. Wrong
  password shows the error in the dialog.

### Recovery rebuilt

- The maintenance worker opens the database **with** migrations (same as a normal start), so recovery can be audited;
  the use case finds the protected Admin itself (no login supplied).
- `RecoverAdministrator` writes `account.recovered` through `AuditedOperation` (Successful, and Failed for a refused
  password), actor null with subject the Admin ("local maintenance").

### Audit categories (none in Activity)

- `account.recovered`, `maintenance.backup-created` (in the current database, after the copy, so the backup does not
  contain its own record), `maintenance.backup-restored` (in the restored database, with the backup's date and
  version; a Failed record stays in the current database), `maintenance.data-reset` (written after the erase: the only
  record left, actor the Admin). Actor null for local maintenance. None is added to `ActivityEligibility`, so
  Activity starts empty after a reset or shows the backup's Activity after a restore.

## Architecture

New feature `apps/server/src/maintenance/`:

- `domain/`: `BackupManifest` value object (format, version, checks), `BackupRejection` failures with reasons.
- `application/use-cases/`: `CreateBackup`, `InspectBackup`, `RestoreBackup`, `ResetApplicationData`, each with its
  driving port. Driven ports: `BackupArchive` (write/read entries), `DataDirectorySnapshot` (database and covers in and
  out, swap and roll back), `ApplicationDataEraser`, `CoverFileCleanup`, `SessionKeyRotation`, `ApplicationVersion`,
  `ProtectedAdministrator` (password check through identity's contract).
- `infrastructure/adapters/driven/`: `fflate` archive adapter, filesystem snapshot adapter, Kysely eraser; driving:
  `maintenance.controller.ts` (data reset only) and the worker entry composed in root config.
- `identity`: `RecoverAdministrator` finds the protected Admin and is audited; a small `ProtectedAdministratorStatus`
  use case gives the username to the window.
- `apps/desktop`: menu, maintenance window, preload bridge, native dialogs, worker messages (`maintenance-status`,
  `recover`, `backup`, `inspect`, `restore`). The application version comes from `app.getVersion()` and is passed to
  the worker.

## Steps (one commit each)

1. [x] Status table and Task 8 checks line.
2. [ ] Recovery rebuilt: migrated open, protected Admin lookup, `account.recovered` audit; unit and adapter tests.
3. [ ] Backup: manifest, archive adapter, `CreateBackup`, worker message; unit and adapter tests (temporary
   directories).
4. [ ] Restore: inspection, validation, swap and roll back, session key rotation, audit; unit and adapter tests
   (invalid file, other version, damaged checksum, missing cover, failure during the swap keeps the data).
5. [ ] Maintenance window: menu, launch option, page EN/FR, bridge, dialogs, restart after closing; Electron desktop
   tests.
6. [ ] Data reset backend: eraser moved and extended, `ResetApplicationData`, endpoint; unit and API tests (Admin
   success, Owner and Guest refused, signed out, wrong password, CSRF, sessions ended, colour scheme back to Spring
   green, backups untouched, dev reset still passes).
7. [ ] Data reset in Libris: panel and dialog, EN/FR, component tests, Playwright journey.
8. [ ] Docs (README, architecture, owning docs' implementation references), architecture review, `npm run check`,
   Status table, notes for Task 10, push and pull request.

## Test list mapped to acceptance examples

- Release 3 (maintenance before sign-in, no browser route): desktop test opens the maintenance window from the menu and
  from `--maintenance`; API test that no maintenance route except the data reset exists; the window's bridge is absent
  from the Libris window (existing test extended).
- Release 4 (backup contents): adapter test builds a library with every kind of record and a cover, creates a backup,
  reads the archive: manifest, database rows, cover bytes; the session key is absent.
- Release 5 (same-version restore, another computer): restore into an empty data directory and into one with other
  data; accounts and passwords from the backup sign in; old sessions refused; desktop test of the confirmation flow.
- Release 6 (rejections): not a ZIP, ZIP without manifest, other application, other version, wrong checksum, missing
  cover, damaged database; each leaves the current data byte-identical. A failure injected during the swap rolls back.
- Release 7 (data reset): use-case and API tests for the erased and kept data, preferences to defaults, sessions ended,
  `403` for Owner and Guest, `400` wrong password; Playwright journey: Admin resets, lands on sign-in, signs in again,
  empty Overview and Activity, Spring green.
- Release 8: backup files in the backup folder survive a reset; no maintenance action deletes the Admin.
- Accounts 11 (recovery): data kept, Admin sessions ended, temporary password, audit record; desktop test through the
  window.
- Accounts 12: covered by Release 7.

## Answers from the user (2026-11-08)

1. Opening: the native menu entry that stops the server, plus the `--maintenance` launch option (replaces
   `--reset-admin --login`).
2. Backup file: a `.mcbackup` ZIP whose name carries the date and time. Not encrypted, default folder
   `Documents/Media Collection backups`.
3. The reset keeps the HTTP port, the HTTPS settings and certificate, and the Admin's language; the backup includes all
   of them.
4. Recovery, backup, restore and data reset are audited; none appears in Activity.

## Notes for later tasks

(filled in at the end of the task)
