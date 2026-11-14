# Release expectations

Status: Task 7 product decisions complete. Product expectations and acceptance examples only; technical agents decide implementation and deployment mechanisms. The subsequent update decisions are recorded in [application updates](updates.md).

## Languages

Initial release supports English and French. Each user chooses independently; changing one preference must not affect others. Before login, use the device/browser language when English or French, otherwise English, with a language selector. After login, apply the user's saved preference. Currency remains euros regardless of language; configurable currency is future scope.

## Offline use and connectivity

Core desktop library management must work without internet, including access to locally stored book data and its existing business operations. External metadata/cover lookup requires internet and must report unavailability under the confirmed desktop/mobile failure rules.

Mobile shopping works whenever it can reach the installation's host. No separate offline mobile copy or synchronization feature is implied. Mobile scanning does not acquire a manual-entry fallback when internet lookup is unavailable.

External internet access remains expected. The Admin sets it up from the server settings with one action, Set up internet access, that needs no technical knowledge: the application opens the router port itself when the router allows it (otherwise it shows the exact values to enter), gets a trusted certificate for the home's public address, renews it automatically, and shows the address with a QR code for the phone. HTTPS is the recommended way; plain HTTP can also be opened to the internet at the Admin's explicit request (see below). Manual certificate import remains an advanced setting. No server run by Media Collection is introduced. Existing listening-port constraints remain in force. The HTTP and HTTPS ports, set in Server settings › Ports, are used both on this computer and outside on the router, so internet addresses and QR codes include the port; router port 443 is opened only while Let's Encrypt checks the computer, then closed. Details: [Task 9.5](../plans/task-09-5-internet-access-https.md) (decided 2026-11-08) and [issue #21](../plans/issue-21-internet-ports.md) (decided 2026-11-10).

Optionally, the Admin saves a domain name they own that already points to the home connection (kept up to date by the router's dynamic DNS or by hand). Saving checks that the name points to the public address and refuses it otherwise. The internet addresses then use the name: the HTTPS certificate covers the name (renewed at two thirds of its lifetime, about every 60 days for today's 90-day certificates) and the addresses stay the same when the public IP changes. The application never edits DNS records and asks for no DNS provider account.

When HTTPS cannot be set up, the Admin may open HTTP to the internet: the application opens the router rule for the HTTP port (same external and internal port) and warns that HTTP is not encrypted. A successful HTTPS setup closes it, and it cannot be opened while HTTPS is on. Details: [Task 9.6](../plans/task-09-6-internet-access-domain-name.md) (decided 2026-11-09).

## Backup and restore

A user-facing full backup/restore feature is included initially. Both manual Create backup and Restore backup are exclusive to local Electron maintenance, alongside Recover Admin access, available before normal application login. They are not authenticated Admin-settings features and have no HTTP/browser/mobile equivalent. This supersedes the earlier Admin-only application-role placement and uses the same host OS-account trust boundary as local recovery. Automatic/scheduled backups are future scope.

Backup contents include books/covers, collections, locations, tags, users, personal reading statuses/notes, receivers/loans, audit history, and saved application settings. This is a full application-data backup, not merely title export.

Restoration replaces current application data with the backup state, including the backed-up user identities and passwords, with explicit confirmation; there is no merge workflow. Do not force a new Admin password during restore. Local Admin recovery is the failsafe if restored credentials are forgotten. After successful restore, end all sessions and require fresh login. Invalid/incompatible backups must be clearly rejected; a failed restore preserves current application data. Normal application note privacy remains unchanged; local full-data maintenance is a separate privileged host capability.

### Version compatibility

Local maintenance placement and preserved passwords are confirmed. Password hashing and session-key implementation are technical-agent concerns, not a reason to remove restored credentials. Any future implementation must satisfy the agreed restore/login outcome.

Initially allow restoration only into the same MC application version that created the backup, including on another computer. Identify the originating version and clearly reject a different version without changing current data. Broader cross-version restoration is future scope. Same-version portability must not depend on the original computer being available.

Update-time full backup is approved under [application updates](updates.md): automatic before integrated Windows installation, and through Create backup and open download page for manual Linux installation. Routine scheduled backup remains future scope.

Backups must respect established privacy requirements; exact protection/storage techniques are technical decisions after product scope is defined. A backup feature is not an implicit v1 import feature or an account-recovery replacement.

## Import from v1

Importing v1 data is future scope. The earlier database used MongoDB, and the user retains dumps. Since MC v1 had only one user, migration will probably be a one-off script/operation rather than a product import interface. No initial dump import, reusable import UI, legacy-code reuse, or migration compatibility guarantee is required.

## Admin data reset

The protected Admin may reset application data from authenticated Admin settings only. Require the current Admin password and explicit confirmation clearly identifying what is erased and that Admin credentials remain.

Keep Admin's current username/password; delete books, covers, collections, locations, tags, receivers, loans, audit/Activity history, other users, and application preferences. Previously agreed local pre-login recovery only restores Admin access and preserves data. There is no pre-login factory reset.

Separately saved backup files remain untouched by Admin data reset. After a successful reset, end all sessions and return to login; the retained Admin username/password remain valid and saved application preferences return to defaults. This does not authorize deleting the external optional startup-override file or other files outside application-owned reset data. Configuration overrides remain distinct from saved preferences under [configuration](configuration.md).

## Follow-up after Task 7

The completed [application-update document](updates.md) records confirmed platform behavior and acceptance examples. Technical implementation remains delegated.

## Acceptance examples

1. Before login, a French device/browser defaults to French, an English one to English, and an unsupported language to English; a selector is available. Login applies the user's saved EN/FR preference without changing others.
2. Disconnect internet: core desktop library operations continue on local data. External lookup reports its failure; desktop manual fallback and mobile limited-retry rules remain distinct. Mobile shopping still works if it reaches the host.
3. Open local Electron maintenance before login: manual backup and restore are available alongside Admin recovery. No browser/mobile or authenticated Admin-settings backup/restore route is offered.
4. Create a backup: it includes library metadata/covers, organisation, users/personal data, loans/receivers, audit history, and saved settings; no scheduled backup or reusable v1 import UI is implied.
5. Restore a same-version backup on another computer: replace current data after confirmation, retain backed-up accounts/passwords, end sessions, and require login. Forgotten Admin credentials use local recovery.
6. Restore a different-version, invalid, or incompatible backup: clearly reject it without changing current data. Failed restoration preserves the current state.
7. Run authenticated Admin data reset with current-password confirmation: clear the agreed data and preferences, keep Admin credentials, end sessions, and return to login. Non-Admin users cannot perform it.
8. Separately saved backups survive Admin data reset; the reset does not erase the protected Admin or offer pre-login factory deletion.
9. Set up internet access with the default ports: phones open `https://<address>:34443`, the router has the rule 34443 → 34443, and port 443 is open only during each Let's Encrypt check (setup, Check again, renewal). With a rule added by hand and a domain name, the panel says "Open port 443 on your router before {date}". More examples: [issue #21](../plans/issue-21-internet-ports.md#acceptance-examples).

## Handoff and explicit deferrals

Technical agents design storage, backup format/validation and protection, credential/session handling, transport, and recovery/maintenance mechanisms to satisfy these outcomes. Saved application settings are backup data; machine-specific deployment/runtime details must not silently undermine portability or the optional override-file boundary.

Future scope includes broader backup-version compatibility, scheduled backups, and likely one-off v1 migration. MC version updates follow the separate [approved update rules](updates.md). Missing visual assets and implementation work do not mean the approved business rules are undecided.
