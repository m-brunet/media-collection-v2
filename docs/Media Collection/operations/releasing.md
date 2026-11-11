# Releasing a version

How a new version of Media Collection reaches users. The builds run on GitHub Actions
(`.github/workflows/release.yml`), one runner per system: Windows (NSIS installer) and Linux (AppImage). macOS is not
supported for now. Users get updates from the published GitHub Releases ([application updates](updates.md)), so a
release is public as soon as it is published, and only then.

## Steps

1. **Check locally**, on the commit to release: `npm run check` passes, and on Windows `npm run package` then
   `npm run test:packaged` pass (the smoke test runs a copy of the application outside the checkout).
2. **Version commit**: set `version` in the root `package.json` (the only version number: installer, About window,
   backups, update check), for example `2.0.1`, and commit `chore: version 2.0.1` on `master`.
3. **Tag and push**: `git tag v2.0.1` then `git push origin master v2.0.1`. The tag must be `v` + the version: the
   workflow stops otherwise.
4. **Wait for the workflow** (Actions tab, "Release"): the Windows and Linux jobs each build, run the packaged smoke
   test, and attach their files to a **draft** release named after the version:
   - `Media-Collection-Setup-2.0.1.exe`, its `.blockmap` and `latest.yml` (Windows);
   - `Media-Collection-2.0.1.AppImage` and `latest-linux.yml` (Linux).
   If a job fails, nothing is published: fix, delete the tag (`git push origin :v2.0.1`, `git tag -d v2.0.1`) and the
   draft, and start again from step 1.
5. **Read the draft** on GitHub (Releases): the five files are there; write the release notes (what changed, and the
   installation notes below); keep "Set as a pre-release" unticked (prereleases are never offered as updates).
6. **Publish** the draft. From then on, installed applications find it at their next start or Check for updates….
7. **Try it**: install from the release page on Windows, or update an installed previous version from File → Check
   for updates….

## Installation notes for the release page

The builds are not code-signed.

- **Windows**: the first time a new installer is opened, Windows SmartScreen may show "Windows protected your PC":
  choose More info, then Run anyway. The installer asks for administrator rights (installation for all users, and
  the Windows Firewall rule that lets browsers and phones reach Media Collection). Updates installed from Media
  Collection itself are not stopped by SmartScreen.
  The last page offers "Launch Media Collection when Windows starts" (unchecked on a first install; over an existing
  installation it shows the current choice). Media Collection then starts hidden at sign-in, in the tray, so Leaf
  works without opening Libris; File › Launch at startup or the tray menu change it later.
- **Linux**: make the AppImage executable (`chmod +x Media-Collection-2.0.1.AppImage`) and start it. If a firewall is
  on, allow the HTTP port shown in Server settings (and the HTTPS port when internet access is used).

## Trying the workflow without a release

A pull request that changes the packaging (`build/`, `package.json`, `package-lock.json`, the smoke test or the
workflow) runs the same builds and smoke tests without publishing anything; so does Run workflow on the Actions tab.
The installers are then kept for a week on the run page.

## Cost

While the repository is private, a release uses about 15 of the 2,000 free Actions minutes a month (first run on
2026-11-10: Windows 4.5 minutes, counted double; Linux 1.2 minutes). Once the repository is public, standard runners are free.
