# Task 10 — Release readiness

Status: decisions recorded (2026-11-08), detailed plan not written yet. It is written once Task 9.5 is merged and
needs the user's approval before implementation. Global plan: [implementation plan](implementation-plan.md).

Owning docs: [updates](../operations/updates.md), [release expectations](../operations/release-expectations.md),
[design guidelines](../design/design-guidelines.md) (Libris icon).

## Scope (from the implementation plan)

- GitHub Releases update checks, Windows integrated download and install with an automatic backup, macOS/Linux
  backup and download page, backup folder, failure handling.
- Packaging and installer. The icon set choice and the credits and licences page moved to KI-6 (2026-11-09): Task 10
  only checks that the credits page is complete for the release and links it from the About window.
- Carried over from earlier work:
  - the Windows Firewall rule in the installer ([Task 9.5](task-09-5-internet-access-https.md)), for the HTTPS port and,
    since [Task 9.6](task-09-6-internet-access-domain-name.md), the HTTP port too;
  - the Libris icon files in `apps/desktop/assets/icons` for the installer (KI-4);
  - the credits page built by KI-6 (Libris `/credits`) is complete: every asset and library added since then is listed;

## Decisions (2026-11-08, with the user)

### Version

- The first release is **2.0.0** (tag `v2.0.0`). V1 lives in `mcn-team/media-collection` and
  `mcn-team/mc-mobile-site`: a student project, abandoned, never released to users. The update check reads only this
  repository's releases, so the V1 numbers never interfere.
- The root `package.json` is the single source of the version (installer, `app.getVersion()`, backup version check).
- `0.1.0` stays during development; the version becomes `2.0.0` in the release step at the very end of the task.
  Backups made with `0.1.0` cannot be restored by 2.0.0: accepted, current data is test data only.
- No V1 migration feature: V1 has no users. Release procedure for the user's own V1 library:
  1. set the version to `2.0.0` (release commit);
  2. run `npm run dev:import-v1` on the development data;
  3. create a backup from the development Maintenance window;
  4. restore it in the installed 2.0.0 (same version, so the restore accepts it).
- The version is shown in the About window.

### Update flow

The update controls are in the menu, not in the Maintenance window. Nobody needs to open Maintenance to update.

- **Check for updates…** in the File menu (Windows, Linux) or the app menu (macOS). The check runs while MC keeps
  working, then a small dialog shows one of:
  - up to date: "You have the latest version (2.0.0)", OK;
  - update available: "Version X is available", Download (Windows) or Create backup and open download page
    (macOS, Linux), and Later;
  - check failed: a short explanation, Retry and Close.
- **Automatic check at startup**: silent when up to date or when it fails; when an update is available it shows the
  same "Version X is available" dialog once.
- **Windows**:
  1. Download runs in the background; MC stays usable for everyone, phones and browsers included.
  2. When it ends: "Version X is ready", Restart and install, and Later. The confirmation carries the warning that
     connected users lose access for a moment (no other warning, no advance notice to connected users).
  3. On confirmation: stop the server, make the full backup, install, restart.
  4. Backup failure: explain, Retry; the server starts again and nothing is installed.
- **macOS and Linux**: Create backup and open download page stops the server for the backup, starts it again, then
  opens the release page. Backup failure: explain, Retry, the page stays unopened.
- **Maintenance window** keeps backup, restore and Admin recovery (Task 9) and adds Open backup folder and the
  recovery steps after a failed update (reinstall the previous version, then restore its backup), reachable with
  `--maintenance` when the application cannot start.
- **`updates.md` changes** (first step of the task): the controls are in the File menu (app menu on macOS) instead
  of "pre-login local maintenance"; same trust boundary (host computer only, no MC account). Acceptance example 2
  is rewritten; the others stay valid.
- **Testing**: the update path is tested for real with the first 2.0.1. If it does not work, the fix ships in that
  update (installed manually). No prerelease channel or test setting for it; prereleases stay excluded.

### Menus

| Menu | Windows and Linux | macOS |
| --- | --- | --- |
| App menu ("Media Collection") | none | About Media Collection, Check for updates…, Quit |
| File | About Media Collection, Check for updates…, Exit | Close Window (as now) |
| Edit | removed | kept (Cmd+C, Cmd+V, Cmd+X, Cmd+A in text fields need it) |
| View | kept | kept |
| Maintenance | kept | kept |
| Window | removed | kept (macOS standard) |

### About window

A small window of our own, in the style of the Maintenance window (Electron's built-in panel differs per system and
is limited on Windows): the Libris icon, "Media Collection", the version, one line on what the application is, links
to the GitHub repository and the licence, and a Credits and licences button that opens the credits page.

### Backup folder

The system Documents folder (`app.getPath('documents')`, already used by Task 9 in
`apps/desktop/src/maintenance-window.adapter.ts`), the same folder for manual and update backups:

| System | Folder |
| --- | --- |
| Windows | `Documents\Media Collection backups` |
| macOS | `~/Documents/Media Collection backups` |
| Linux | `~/Documents/Media Collection backups` (or the folder the desktop sets as Documents) |

The folder is created when missing (test it, Linux included). Update backups are never deleted automatically.

### Builds

- electron-builder already declares the three targets in `package.json`: Windows `nsis`, macOS `dmg`, Linux
  `AppImage`. Only Windows has been built so far.
- Release builds run on **GitHub Actions**, one runner per system: `better-sqlite3`, `sharp` and Electron are native
  per system (`npmRebuild` is `false`), and a `dmg` can only be made on macOS. Each runner attaches its build to the
  GitHub Release. Local builds on Windows stay for trying the Windows installer.
- The repository is public before the release (updates.md).

## Open questions

- **macOS signing**: unsigned (ad-hoc signature, free; macOS blocks the first launch and the user clicks Open Anyway
  in System Settings → Privacy & Security, likely again for each new version) or Developer ID with notarization
  (Apple Developer account, $99 a year; opens normally, can run on GitHub Actions). Suggested: start unsigned, with
  the Open Anyway steps on the release page and in the README.
- Where the About window's Credits and licences button opens the credits page (main window or default browser).
