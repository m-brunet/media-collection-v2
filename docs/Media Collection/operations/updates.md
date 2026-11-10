# Application updates

Status: product decisions complete. Confirmed behavior and acceptance examples only; technical agents choose the implementation.

## Distribution and access

Use GitHub Releases for release information and application downloads, without an update server operated by MC. The repository is expected to be public before release.

Supported systems are Windows and Linux. macOS is dropped for now (decided 2026-11-10): without an Apple Developer account the application cannot be signed and notarized, and macOS would block it.

Update controls are exclusive to the local Electron application. Desktop browser and mobile clients use the version running on their host installation and do not install separate updates.

Place the controls in the local Electron application's File menu (About Media Collection, Check for updates…), not in the Maintenance window: nobody needs to open maintenance to update. They are available before sign-in and without an MC account; the same host-local trust boundary as maintenance applies (only someone at the host computer can use them). The Maintenance window keeps backup/restore and Admin recovery, and adds Open backup folder and the recovery steps after a failed update.

Offer stable releases only initially. Beta/prerelease versions are excluded from normal update offers.

Check for updates automatically at startup without delaying application access. Also provide a manual Check for updates action. Installation requires explicit user approval and can always be postponed; there is no forced installation.

Until the repository is public (in-house trial, decided 2026-11-10), Check for updates… is shown disabled and nothing is checked at startup; a newer version is installed by running its installer over the installed one, which keeps the data.

## Windows

Provide integrated download and installation through GitHub Releases. Automatically create a full application-data backup before installation. If backup creation fails, stop the update rather than install without the backup.

Download while MC remains usable. Installation requires an explicit Restart and install confirmation, warning that connected desktop-browser/mobile users will temporarily lose access. The user may postpone installation after downloading.

Use only this confirmation: do not add a separate unsaved-changes warning or an advance notification to connected browser/mobile users for the update restart. This does not remove the normal unsaved-form navigation rules outside this update flow.

Create the full backup after the user confirms Restart and install, immediately before installation, so it includes saved changes made during download. The precise means of obtaining a consistent backup and coordinating writes belongs to technical design.

## Linux

Installation is manual. Provide a Create backup and open download page action: create the full application-data backup, then open the release download page so the user can download and install the new version.

If backup creation fails, explain the failure and offer Retry. Do not open the download page through this combined action until backup creation succeeds.

Integrated installation is Windows-only. Manual installation on Linux does not remove its backup/restore capability.

## Relationship to backup and restore

Update backups use the full-data scope in [release expectations](release-expectations.md). This is an approved exception to the deferral of routine automatic/scheduled backups. Standalone manual backup and restore remain in local Electron maintenance, which also offers Open backup folder.

Save update backups automatically in a dedicated folder and provide an Open backup folder action. Keep them until the user removes them manually; no automatic deletion initially. The exact filesystem location belongs to technical design.

Initial restore compatibility remains the exact MC version that created the backup. Update-time backup does not itself authorize cross-version restoration or automatic rollback.

## Failures and recovery

Failed checks or downloads leave MC usable, explain the problem, and offer Retry. Failed Windows backups also explain the failure and offer Retry while blocking installation. The Linux combined action likewise requires a successful backup before opening the download page.

Successful updates preserve application data and saved settings. If installation or data upgrade fails, provide a clear recovery explanation and access to the backup folder. Initial recovery is manual; automatic rollback is not required. Under the same-version restore rule, recovery may require reinstalling the previous MC version before restoring its backup. Technical agents design how recovery guidance and backup access remain available when the normal application cannot start.

## Acceptance examples

1. Start local Electron: check for stable updates without delaying application access. A manual check is also available; prereleases are not offered.
2. Open the File menu of the local Electron application, signed in or not: Check for updates… is available without an MC login and without opening the Maintenance window. Browser/mobile clients cannot initiate host updates.
3. On Windows, approve downloading an update: MC remains usable while it downloads. Postpone installation without a forced restart.
4. Confirm Restart and install: show the temporary remote-access interruption warning in that confirmation, with no separate unsaved-work warning or remote advance notice. Create a full backup immediately before installation, including saved changes made during download.
5. Fail a Windows backup: explain the failure, offer Retry, and do not install. Failed checks/downloads also explain the failure and offer Retry without blocking normal MC use.
6. On Linux, choose Create backup and open download page: save the full backup before opening the release page. A failed backup offers Retry and leaves that page unopened through this action.
7. Open the dedicated backup folder through MC: update backups remain available until manually removed; they are not automatically pruned.
8. Complete an update: preserve application data and saved settings. On update failure, provide manual recovery guidance and access to the backup folder; a pre-update backup requires its originating MC version for restoration.

## Implementation handoff

Technical agents determine packaging/signing, release metadata, download validation, consistent backup and write coordination, installer/data-upgrade behavior, and recovery mechanisms. These mechanisms must satisfy the product outcomes above without introducing a separate MC-operated update server. Integrated installation outside Windows, macOS support, prerelease channels, automatic rollback, and automatic backup pruning are not required initially.
