# Accounts and personal data

Status: Task 5 product decisions complete. This document records business behavior and acceptance examples, not authentication implementation choices.

## Installation and first administrator

One installation contains one shared library and exactly one protected Admin: the first user. There is no public registration/sign-up feature.

The application's first launch must immediately present a form to define the administrator password before normal use. This is installation setup, not a public registration flow. The administrator chooses its username and password in this form. Setup is accepted only in the Media Collection desktop window (Electron), not from any browser, including one on the same computer; browsers are asked to finish setup in the app window, so nobody else can claim the library first. Technically, the desktop process creates a random secret at each launch and attaches it only to its own window's setup requests.

The protected Admin cannot be modified or deleted by other accounts, and cannot deactivate, delete, or demote itself. Its existing self-service username/password editing remains allowed. Only Admin creates users and chooses their Guest/Owner role, manages other accounts, or resets application data. Roles are fixed at creation: no later upgrade or demotion, including by Admin. This supersedes earlier proposals allowing Admin to change roles.

## Later account creation

Only Admin creates later accounts through the interface and chooses Guest or Owner at creation. Do not introduce another registration route or assume a product-level default role. Admin sets a temporary password; the user must replace it at first login before normal use. When Admin resets another user's password, the same temporary-password and mandatory-change flow applies. No email is involved. This is distinct from the first-launch Admin form and from a user's ordinary change of their own password.

Accounts have usernames/passwords, not email, real-name, or civility fields. Usernames keep the letter case chosen for them and sign-in requires that exact spelling, like passwords; outer spaces are ignored. Two accounts cannot have usernames that differ only by letter case. Users may manage their own username/password. Guests cannot change shared books and have no personal notes or reading-status display. They may be household friends in real life, but accounts and lending receivers have no application link.

Each user may independently choose English or French without changing other users' language preference.

Task 6 clarification: Guests cannot access the mobile interface, including shopping. Their approved desktop read access and self-account management remain unchanged. Mobile is for Owners/Admin only.

## Deactivation and reactivation

Only Admin may deactivate an account; Owners/Guests cannot deactivate themselves. Deletion deactivates rather than removes the user record. End its existing sessions immediately and prevent further login. Retain the record indefinitely for audit attribution. Its username remains reserved, so a different account cannot take it while the account is deactivated. The protected Admin cannot be deactivated.

Admin may reactivate an account with its original fixed role. Retain its reading statuses and private notes so it regains its own access; reactivation must not make notes readable by another account. Guests still have no reading/notes interface. There are no role-transition workflows.

The authenticated data reset in Admin settings is the explicit retention exception: remove all other users and their data along with library/audit/loan data, keeping the first Admin's current username/password. There is no pre-login factory reset that deletes Admin or returns the installation to first-user setup.

## Personal reading status and notes

Owners/Admin have personal Read/Not read state and at most one optional private free-text note per book. Notes are author-only, including against other Owners/Admin. Creation, form placement, and note deletion are defined in [book entry](book-entry.md).

A new Owner starts with every existing book Not read. Newly added books start Not read independently for every Owner/Admin. One account's change never changes another's state. Guests have no personal reading feature. Roles never change, so no reading/notes migration between roles is required.

## Username changes and reuse

An active user may rename their account. The released name may be reused by another account; deactivated accounts' current names remain reserved. Audit actor references, loan actions, reading state, and private notes stay with the original account identity, never with the text of its former username. Activity timestamp details continue to show the acting account's current username, not the new holder of a released name.

Product consequence: people may remember an old name differently from the current attribution. This is an accepted direction for reuse, not a requirement for historical display-name snapshots or user merging. Informing users of a rename in the appropriate existing account/audit experience must not expose private note contents.

## Local recovery

Pre-login recovery is available only locally through Electron on the host, with no HTTP recovery endpoint. It shows the protected Admin username and allows setting a new password without the old credentials or a recovery key, trusting access to the host OS account. Preserve library data and end the Admin's existing sessions. This is separate from Admin managing another user's password.

Recovery restores credentials; it does not erase data or delete/recreate the Admin. The user's earlier factory-reset reference was clarified in favor of this recovery feature, not an additional destructive action.

Task 7 adds manual backup and restore beside recovery in local pre-login Electron maintenance, not under authenticated application roles or browser routes. These actions share recovery's host OS-account trust boundary. Restore reinstates backed-up user identities/passwords and signs everyone out; if credentials are forgotten, use Admin recovery. This is distinct from the authenticated Admin-settings data reset, which still keeps the current Admin credentials. See [release expectations](release-expectations.md).

## Acceptance examples

1. First launch presents Admin password setup immediately; normal use is unavailable until completed. There is no public account registration.
2. Admin creates a later account and chooses Guest or Owner. Its temporary password requires replacement before normal use. No email is requested.
3. Admin resets another user's password: the replacement is temporary and must be changed at next login before normal use.
4. Owner/Guest edits their own username/password but cannot create/manage other users, change roles, or deactivate themselves.
5. Any account attempts a role upgrade/demotion, including Admin through user management: no role-change operation is available. Roles remain fixed.
6. Protected Admin attempts self-deactivation/deletion/demotion: blocked. Self username/password changes remain available.
7. Admin deactivates another account: end all its sessions, block login, retain identity/personal data, and reserve its username.
8. Admin reactivates that account: original fixed role and personal data remain; other accounts gain no access to its private notes.
9. An active user renames themselves and another account adopts the released name: attribution and personal data stay with the original identity. Timestamp details use the acting identity's current name.
10. Create an Owner with books already in the library: all initially Not read for that Owner. Add a book later: Not read independently for each Owner/Admin. Guests see no personal reading or note feature.
11. Recover Admin credentials before login in local Electron: preserve library/users/data, set the Admin password, and end its existing sessions. External browsers/mobile have no equivalent recovery endpoint.
12. Reset data from authenticated Admin settings: remove other users and application data while keeping Admin's current username/password. No pre-login erase-all action or Admin deletion is introduced.

## Assigned follow-ups

Task 6 covers setup/login/temporary-password/self-settings/user-management/recovery screen treatment and feedback. Task 7 finalizes data-reset confirmation, backup expectations, and operational consequences. These tasks must preserve the access and retention rules here. Technical agents choose authentication/session mechanisms, storage, and authorization enforcement; no such implementation is prescribed by this product closure.
