# Task 10 — Release readiness

Status: **in progress**, plan approved by the user on 2026-11-10. Decisions recorded on 2026-11-08 and
2026-11-10; every question is answered (see [Answers from the user](#answers-from-the-user-2026-11-10)). Branch `docs/task-10-decisions`.
Global plan: [implementation plan](implementation-plan.md).

Owning docs: [updates](../operations/updates.md), [release expectations](../operations/release-expectations.md),
[design guidelines](../design/design-guidelines.md) (Libris icon).

## Scope (from the implementation plan)

- GitHub Releases update checks, Windows integrated download and install with an automatic backup, Linux backup and
  download page, backup folder, failure handling. macOS is dropped (see Systems below).
- Packaging and installer. The icon set choice and the credits and licences page moved to KI-6 (2026-11-09): Task 10
  only checks that the credits page is complete for the release and links it from the About window.
- Carried over from earlier work:
  - the Windows Firewall rule in the installer ([Task 9.5](task-09-5-internet-access-https.md)), for the HTTPS port and,
    since [Task 9.6](task-09-6-internet-access-domain-name.md), the HTTP port too;
  - the Libris icon files in `apps/desktop/assets/icons` for the installer (KI-4);
  - [KI-14](known-issues.md#ki-14--desktop-dialogs-menus-and-window-titles-are-only-in-english): desktop dialogs,
    menus and window titles in English and French (device language); the new menus, About window and update dialogs
    are written translated from the start;
  - the credits page built by KI-6 (Libris `/credits`) is complete: every asset and library added since then is listed;
- Pre-publication check of the repository before it is made public (see Going public below).

## Decisions (2026-11-08 and 2026-11-10, with the user)

### Systems (2026-11-10)

- Windows and Linux only. **macOS is dropped for now**: there is no Apple Developer account, so the application
  cannot be signed and notarized, and an unsigned build is blocked by macOS at each new version. It can come back
  later with an account.
- Removed with it: the macOS app menu, the `mac`/`dmg` electron-builder target, the macOS runner and the signing
  question.

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

- **Check for updates…** in the File menu. The check runs while MC keeps
  working, then a small dialog shows one of:
  - up to date: "You have the latest version (2.0.0)", OK;
  - update available: "Version X is available", Download (Windows) or Create backup and open download page
    (Linux), and Later;
  - check failed: a short explanation, Retry and Close.
- **Automatic check at startup**: silent when up to date or when it fails; when an update is available it shows the
  same "Version X is available" dialog once.
- **Windows**:
  1. Download runs in the background; MC stays usable for everyone, phones and browsers included.
  2. When it ends: "Version X is ready", Restart and install, and Later. The confirmation carries the warning that
     connected users lose access for a moment (no other warning, no advance notice to connected users).
  3. On confirmation: stop the server, make the full backup, install, restart.
  4. Backup failure: explain, Retry; the server starts again and nothing is installed.
- **Linux**: Create backup and open download page stops the server for the backup, starts it again, then
  opens the release page. Backup failure: explain, Retry, the page stays unopened.
- **Maintenance window** keeps backup, restore and Admin recovery (Task 9) and adds Open backup folder and the
  recovery steps after a failed update (reinstall the previous version, then restore its backup), reachable with
  `--maintenance` when the application cannot start.
- **`updates.md` changes** (first step of the task): the controls are in the File menu instead
  of "pre-login local maintenance"; same trust boundary (host computer only, no MC account). Acceptance example 2
  is rewritten; the others stay valid.
- **Testing**: the update path is tested for real with the first 2.0.1. If it does not work, the fix ships in that
  update (installed manually). No prerelease channel or test setting for it; prereleases stay excluded.

### Menus

| Menu | Windows and Linux |
| --- | --- |
| File | About Media Collection, Check for updates…, Exit |
| Edit | removed |
| View | kept |
| Maintenance | kept |
| Window | removed |

The current macOS-only app menu in `apps/desktop/src/main.ts` is removed with the rest of the macOS support.

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
| Linux | `~/Documents/Media Collection backups` (or the folder the desktop sets as Documents) |

The folder is created when missing (test it, Linux included). Update backups are never deleted automatically.

### Builds

- electron-builder declares two targets in `package.json`: Windows `nsis` and Linux `AppImage` (the macOS `dmg`
  target was removed on 2026-11-10). Only Windows has been built so far.
- Release builds run on **GitHub Actions** (chosen 2026-11-10), one runner per system: `better-sqlite3`, `sharp` and
  Electron are native per system (`npmRebuild` is `false`), so the Linux build needs a Linux machine. A version tag
  (`v*`) starts a Windows and a Linux job; each attaches its build to the GitHub Release. Local builds on Windows stay
  for trying the Windows installer.
- Cost: about 30–40 counted minutes per release while the repository is private (Windows minutes count double), well
  within the free 2,000 a month; free once it is public. The README line "the project includes no
  continuous-integration pipeline" is updated when the workflow is added.

### Going public

The repository is public before the release (updates.md): the in-app update check reads GitHub Releases without a
token, which only works on a public repository. Made public after the in-app work and before `v2.0.0`. Going public
cannot really be undone (clones, forks, caches), so a full check comes first:

1. Secret scan of the contents of every commit on every branch with gitleaks (a 2026-11-10 check of file names found
   no committed `config.json`, `.env`, keys, certificates or databases; contents were not scanned).
2. Commit author email: kept as it is (decided 2026-11-10); the history is not rewritten.
3. Review what becomes public in `docs/` (plans, known issues) and `.obsidian/` workspace files; keep or remove.
4. After the switch: turn on GitHub secret scanning and push protection.

## Design

Everything new lives in the Electron application (`apps/desktop`): updates, menus, the About window and the installer
are Electron lifecycle concerns, so no backend feature, no HTTP endpoint and no new business IPC. The Libris and Leaf
code only changes for the credits page. `main.ts` is already long: the menu, the update flow and the About window go
into their own classes, and `main.ts` keeps the lifecycle and wires them.

### Updates

- **Library:** `electron-updater` (MIT, from the electron-builder project; chosen by the user on 2026-11-10). It reads the
  `latest.yml` / `latest-linux.yml` files electron-builder publishes with each GitHub Release, ignores drafts and
  prereleases (`allowPrerelease: false`), checks the download against the SHA-512 in that file, and on Windows runs the
  NSIS installer silently and restarts the application. `autoDownload` and `autoInstallOnAppQuit` are off: nothing is
  downloaded or installed without the user's choice.
- **Source:** `build.publish` in `package.json` names the GitHub provider (`m-brunet/media-collection-v2`); the
  installer embeds it (`app-update.yml`). No update server of our own.
- **Classes** (`apps/desktop/src`, names indicative):
  - `UpdateSource` interface with two adapters: `ElectronUpdaterSource` (production) and a stand-in for the tests,
    chosen by an environment variable the test harness sets, like the Task 9.5 internet-access stand-ins. No test
    reaches GitHub.
  - `ApplicationUpdates`: the state machine (idle, checking, available, downloading, ready, failed) and the rules:
    silent startup check, one "available" dialog per start, Windows download then "ready", Linux backup then download
    page. It owns no Electron window code; it asks an `UpdateDialogs` class to show the dialogs and a `BackupBeforeUpdate`
    class to make the backup.
  - `BackupBeforeUpdate`: stops the backend, makes the full backup through the existing worker message `backup`
    (`LocalMaintenance.createBackup`) into the backup folder, with the file name
    `Media Collection backup YYYY-MM-DD HH-mm-ss before X.mcbackup` (`BackupFileName` gains the optional suffix).
    On failure it restarts the backend and reports the error.
- **Menu item states:** "Check for updates…" becomes "Downloading version X…" (disabled) during the download and
  "Restart and install version X…" once it is ready, so a postponed install can be resumed without a new check.
- **Windows install:** confirmation "Restart and install" (with the warning that connected browsers and phones lose
  access for a moment) → stop the backend → backup → `quitAndInstall`. Backup failure: explain, Retry, Cancel; on
  Cancel the backend starts again and nothing is installed. The quit path reuses the existing `before-quit` handling:
  an unsaved book form can still say Stay, and then nothing is installed.
- **Linux:** "Create backup and open download page" → stop the backend → backup → start it again → open the release
  page (`html_url` of the release) in the default browser. Backup failure: explain, Retry, Cancel; the page stays
  unopened.
- **Startup check:** a few seconds after the window shows, never blocking it; silent when up to date or when it fails;
  shows the "available" dialog at most once per start. Later means nothing more until the next start or a manual
  check. No "skip this version" (not asked for).
- **Development:** the check is off when the application is not packaged (no `app-update.yml`), except with the test
  stand-in.

### Backup folder

`BackupFolder` (one class, used by the Maintenance window and the update backup): `Documents/Media Collection
backups`, created when missing. The Maintenance window's create and restore dialogs use it instead of their own copy of
the path.

### Maintenance window

- New action **Open backup folder** (creates it when missing, opens it with `shell.openPath`). New IPC channel
  `maintenance:open-backup-folder`, same sender checks as the others; no path comes from the page.
- New section **After a failed update**: the recovery steps in EN/FR (reinstall the previous version from the
  release page, open it with `--maintenance` if it does not start, restore the backup made before the update) and
  the link to the releases page.

### About window

`AboutWindow` (same pattern as `MaintenanceWindow`: local page `apps/desktop/assets/about.html` / `.js` / `.css`, its
own preload, sandboxed, no navigation, no menu bar, one instance at a time). Content: the Libris icon, "Media
Collection", the version (`app.getVersion()`), one line on what the application is, links to the repository and the
licence (opened in the default browser by the main process from fixed targets; the page only sends `repository`,
`licence` or `credits`), and **Credits and licences**, which opens `/credits` in the Libris window and brings it to the
front (chosen by the user on 2026-11-10). The repository URL comes from the `repository` field added to `package.json`.

### Desktop texts in English and French (KI-14)

- `DesktopTexts` (static catalogue, EN and FR side by side) and `DesktopLanguage` (French when the first of
  `app.getPreferredSystemLanguages()` starts with `fr`, otherwise English).
- Used by every dialog, menu label and window title listed in KI-14, and by everything this task adds. Role menu
  items keep their `role` and get a translated `label`. A raw error message stays as the detail text.
- The Maintenance and About pages receive the language from the main process (through their preload) instead of
  reading `navigator.language` themselves, so one device shows one language. The Maintenance page keeps its selector.

### Menus

`ApplicationMenu` builds the table above with translated labels: File (About Media Collection, Check for updates…,
separator, Exit), View (as now), Maintenance (as now). Edit and Window are removed; copy, paste, cut and select all
keep working in text fields on Windows and Linux without the Edit menu (checked in the desktop e2e test). The macOS
`appMenu` line goes.

### Installer and packaging

- **Version:** the root `package.json` only; `apps/desktop/package.json` loses its own `version` (it is private and
  never published) so there is one number.
- **Windows (NSIS):** assisted installer (not one-click), **per machine** in Program Files (chosen by the user on 2026-11-10), Libris
  icon (`apps/desktop/assets/icons/libris.ico`) for the installer, uninstaller and shortcuts, desktop and Start menu
  shortcuts named "Media Collection", and a Start menu shortcut "Media Collection maintenance" that starts it with
  `--maintenance` (named in the Maintenance window's recovery steps). The uninstaller asks about the application data (decided by the user on 2026-11-10): a page after its welcome page
  with an unticked box "Also delete my Media Collection data". Unticked (the default), the data stays for a later
  installation. Ticked, it deletes `%APPDATA%\Media Collection` (library, covers, accounts, settings, certificates),
  and the page says so: deleted for good, a later installation starts from nothing. Backups in
  `Documents\Media Collection backups` are never deleted by the uninstaller, only by hand. An update's silent
  uninstall never deletes anything. The installer and uninstaller follow the system language (English, French).
- **Firewall rule:** an NSIS include (`build/installer.nsh`, `customInstall` / `customUnInstall`) adds an inbound
  Windows Firewall rule **for the program** (`$INSTDIR\Media Collection.exe`, every protocol, private and public profiles, chosen by the user on 2026-11-10) and
  removes it on uninstall. A program rule covers the HTTP and HTTPS ports whatever they are set to, including a later
  port change in the server settings; the backend runs in an Electron utility process of the same executable. The
  Task 9.5 panel reminder about the Windows prompt is removed once the rule exists.
- **Linux (AppImage):** no firewall step (the desktop distributions do not turn one on by default); the README says
  which port to allow when the user has one.
- **Unsigned:** neither build is code-signed. Windows SmartScreen shows "Windows protected your PC" for the first
  installs of a new version (More info → Run anyway); the release notes and the README give these steps. Updates
  installed by the application are not blocked by SmartScreen.

### Release workflow (GitHub Actions)

`.github/workflows/release.yml`, started by a `v*` tag:

- two jobs, `windows-latest` and `ubuntu-latest`: `npm ci`, build, `electron-builder --publish always`, which creates
  or completes a **draft** GitHub Release with the installer and its `latest*.yml`;
- each job runs `test:packaged` on its own build first (Linux under `xvfb-run`), so a broken native module stops the
  release;
- `GITHUB_TOKEN` with `contents: write` only; no other secret.

The full `npm run check` stays local before tagging, as today (no pull-request pipeline in this task). The user reads
the draft and publishes it; only a published release is offered as an update.

A new doc, `operations/releasing.md`, gives the procedure: check, version commit, tag, wait for the workflow, read the
draft, publish.

### Credits

- Add the line "QR Code is a registered trademark of DENSO WAVE INCORPORATED." (KI-11, not yet on the page).
- Check the page against the rule from KI-6 (every bundled icon set, font, third-party asset, book data source, and
  every library whose licence asks for attribution) and the packages added since. `electron-updater` is MIT and does
  not ask for a credit line; Electron and Chromium licences ship with the installer (`LICENSE.electron.txt`,
  `LICENSES.chromium.html`).

## Steps

Each step: tests, the relevant checks, architecture review skill on the changes, commit, tick below.

- [x] **1. Documentation**: `updates.md` (controls in the File menu, acceptance example 2 rewritten), this plan.
- [x] **2. Desktop texts (KI-14)**: `DesktopLanguage`, `DesktopTexts`, used by the existing dialogs, menus and window
  titles; language passed to the Maintenance page. Unit tests (same keys in both languages, `fr-*` → French, other →
  English); desktop e2e test in French (one dialog, the menu labels).
  Done: the File and View labels come with the new menu in step 3; the test harness takes a device language
  (`language` runtime option) and records the message boxes and menu labels.
- [x] **3. Menus**: `ApplicationMenu` (File, View, Maintenance; Edit and Window removed, no macOS menu). Desktop e2e:
  the labels, Exit quits, copy and paste work in a text field.
  Done: About and Check for updates are added to File in steps 5 and 6. The keyboard check uses Ctrl+A (select all):
  copy and paste would overwrite the clipboard of the computer running the tests.
- [x] **4. Backup folder and Maintenance window**: `BackupFolder`, Open backup folder, the "After a failed update"
  section. Unit test (folder created when missing), maintenance window e2e test.
  Done: `BackupFolder` (`backup-folder.adapter.ts`), `ProjectLinks` (repository, releases, licence URLs), Open the
  releases page in the new section. The recovery steps name a **Media Collection maintenance** shortcut, which the
  installer adds in step 7 (Start menu, starts the application with `--maintenance`).
- [x] **5. About window**: page, preload, links, Credits and licences. Desktop e2e (version shown, links reach the
  stand-in `shell`, credits opens `/credits` in the Libris window).
- [x] **6. Update flow**: `electron-updater`, `UpdateSource` and stand-in, `ApplicationUpdates`, `UpdateDialogs`,
  `BackupBeforeUpdate`, menu item states, startup check. Unit tests of `ApplicationUpdates` (every state change and
  rule above); desktop e2e with the stand-in for each acceptance example in `updates.md`: up to date, available, check
  failed + Retry, startup silent, download while the server answers HTTP, Restart and install makes the backup before
  the install call, backup failure blocks the install and restarts the server, Linux flow opens the page only after the
  backup.
  Done: `electron-updater` 6.8.11; `ScriptedUpdateSource` (`APP_TEST_UPDATES`, unpackaged runs only) stands in for
  GitHub. A new installation with no data skips the backup (nothing to lose). Found and fixed on the way: a quit asked
  while the server restarts (after maintenance or a failed update backup) was ignored, so the application stayed open.
  Unpackaged runs without the test script find no release information and report the version as the latest.
- [x] **7. Installer**: `package.json` build settings, NSIS include with the firewall rule, icons, `repository`
  and `publish` fields, one version. Local Windows build: install, check the rule (`netsh advfirewall firewall show
  rule name="Media Collection"`), start, reach it from a phone, uninstall (rule gone, data kept).
  Done: per-machine assisted NSIS installer with the Libris icon (the executable's icon too: executable editing is
  back on), `build/installer.nsh` (firewall rule for the program, private and public; Start menu shortcut "Media
  Collection maintenance"), `publish` to a draft GitHub Release, file names without spaces
  (`Media-Collection-Setup-<version>.exe`, `Media-Collection-<version>.AppImage`), `repository`, `author`; the
  workspace packages no longer carry their own version. The Libris "allow in the Windows prompt" reminder is removed.
  The local build and `test:packaged` pass. **Waiting for the user:** the install itself needs the administrator
  prompt, so the install, firewall, phone and uninstall checks are done by the user.
  First install by the user (2026-11-10): the backend stopped at start, `rxjs` missing from the package. It is a peer
  dependency of NestJS that was never declared, so electron-builder left it out; the smoke test still passed because
  it ran inside the checkout, where Node found the repository's copy. Fixed: `rxjs` is a declared dependency, and
  `test:packaged` now runs a copy of the unpacked application outside the checkout (it fails on the old build).
  Second install: start, rule, maintenance shortcut and uninstall (rule removed, data in `%APPDATA%\Media Collection`
  and the backups kept) confirmed by the user. A Windows network prompt was seen; the rules it created belong to the
  smoke test's temporary copy, which listened on the network. Now the smoke test listens on 127.0.0.1 only, and the
  installer rule covers every protocol (the router discovery uses UDP), not TCP only.
  Accepted by the user on 2026-11-10, with the uninstaller's data choice and the English and French installer.
- Full check after step 8 (2026-11-10): `npm run check` passed 3005 of 3006 tests; the one failure was a test-harness
  race (a window finishing its load answered another request), fixed by giving each harness answer its own request
  id; the desktop and runtime suites then passed again.
- [x] **8. Credits**: QR trademark line, completeness check; component test updated.
  Done: an optional `notice` on a credit, shown under it (the QR Code trademark line with node-qrcode). Checked
  against the KI-6 rule: no icon, font or asset was added since; the libraries listed are the ones behind a feature
  (book data, images, barcodes, certificates, router, QR codes), so `electron-updater`, like Electron, NestJS and
  React, is not listed. The installer ships `LICENSE.electron.txt` and `LICENSES.chromium.html`.
- [ ] **9. Release workflow**: `release.yml`, `operations/releasing.md`, README (installation, SmartScreen steps,
  release procedure link; the "no continuous-integration pipeline" line updated). Tried with a throwaway tag
  (`v0.1.0-ci.1`, a draft that is deleted afterwards). The Linux AppImage is also started by hand once (WSL with
  WSLg or a Linux machine): it opens, the backup folder is created.
- [ ] **10. Going public**: the four checks under Going public, with the user; the user switches the repository to
  public.
- [ ] **11. Release 2.0.0**: version commit `2.0.0`, the V1 library procedure above, full `npm run check`, tag
  `v2.0.0`, the user reads and publishes the draft, install from the release page on Windows.

Pull requests: steps 1 to 8 on this branch (one pull request, on the user's go-ahead), steps 9 to 11 after it is
merged.

## Acceptance

- The `updates.md` acceptance examples pass with the stand-in, and the update backup is restorable in Maintenance.
- KI-14: on a French system every desktop dialog, menu label and window title is French.
- The installed Windows application is reachable from a phone with no Windows Firewall prompt.
- `v2.0.0` is published from a public repository with a Windows installer and a Linux AppImage built by the workflow.
- First real update test: 2.0.1, as decided.

## Known limits

- The update path between two published versions is only proven by 2.0.1.
- Unsigned builds: SmartScreen warning on Windows for manual installs.
- A failed install or data upgrade is recovered by hand (reinstall the previous version, restore its backup); no
  automatic rollback.
- Per-machine install means a Windows administrator prompt at install and at each update.

## Answers from the user (2026-11-10)

1. **`electron-updater`**: yes, use the existing library rather than our own download check and silent install.
2. **Per-machine install**: yes (Program Files, an administrator prompt at install and at each update), so the
   installer can add the firewall rule.
3. **Firewall profiles**: private and public.
4. **Credits and licences button** (in the About window): opens `/credits` in the Libris window and brings it to the
   front.
5. **Commit author email**: kept as it is; the history is not rewritten.

No open questions remain.
