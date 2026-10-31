# Features

Status: initial v2 baseline, 2026-10-31. Unresolved details are intentionally identified rather than inferred from v1 or the mockups.

## Books

Owners and the protected first administrator can add, edit, and delete books. Guests cannot change shared book data. Manual creation of a single book is always available, including when lookup fails.

| Field | Requirement |
| --- | --- |
| Name/title | Mandatory |
| Authors | Mandatory; one or more, with existing-name suggestions and similarity warnings to reduce mistyping |
| ISBN | Required when available; allow books without an ISBN. One catalogue record per edition, with ISBN uniqueness enforced when present. Format/normalization and duplicate detection without ISBN remain to be defined |
| Category | Books, Manga, or Comics; Books is the default |
| Publisher | Optional |
| Publication date | Optional |
| Summary | Optional |
| Page count | Optional |
| Price | Optional |
| Cover | Manual selection and automatic lookup supported; requiredness and fallback behavior unresolved |
| Ownership | Mandatory shared status: Owned or Not Owned; default Owned |
| Reading status | Mandatory per-user status: Read or Not read; default Not read |
| Collection membership | Optional; when enabled, collection name and volume number are mandatory |
| Physical location | Optional; at most one location |
| Tags | Multiple reusable tags supported |

Manga includes manga, manhwa, manhua, and related forms. Comics includes Franco-Belgian bandes dessinees, American comics, and graphic novels. Personal ratings are excluded. Free-text notes and hiding less-used optional fields behind an additional-fields control remain proposals.

ISBN lookup is a high-priority initial feature. Lookup must not remove the manual-entry option. Providers, cover lookup, result review, incomplete results, and edition matching need discussion. Scanning is an input to book entry, not a separate library.

## Collections

Task 1 is complete. [Collections and shopping](collections.md) is the authoritative consolidated product reference, including acceptance examples.

- Save a book with a collection name to join/create it. Rename updates all member books; a name collision is blocked. Merging is future scope.
- Books cover one integer volume or a consecutive omnibus range. Volume 0 requires the collection option. Count distinct covered volumes, not edition records.
- Missing means expected coverage not Owned, whether saved Not Owned or inferred. The range ends at the highest currently saved coverage; deleting it can shrink the range.
- Finished is explicit, allowed only without missing volumes, and hides the collection on mobile. Gaps automatically reopen it; users may also reopen manually.
- Overlap is permitted only between Owned books. Rare planned-book conflicts require explicit resolution, never silent deletion/replacement.
- Empty collections disappear; deleting a collection preserves its books and clears membership/coverage.
- Mobile uses compact missing-volume entries and emphasizes last owned. Ordinary saved Not Owned entries require confirmation for quick add; inferred volumes and omnibus books cannot use it. Guests remain read-only.

See [edition impact analysis](collection-editions-impact.md) for counting implications. Shared name matching belongs to Task 2; exact screen refinements belong to Task 6. No database or implementation design is prescribed.

## Lending and returns

See [lending business rules](lending.md) and the [Pen design brief](lending-design-brief.md). Owners/Admin lend Owned books and record returns; Guests view loans. A book has at most one active loan. Start from a book page, require a receiver name, and optionally add books. Reuse the author/collection similarity mechanism for receiver names, offering existing-name selection or distinct new-name creation; identical receiver names are not allowed. The return form preselects the starting book and offers other active loans to its receiver. No due date or business return date is required. Loan-history and some lifecycle rules remain under discussion.

## Physical locations

- The hierarchy is Bookcase -> Shelf. There is no Room level.
- Locations describe actual storage, independently of tags, collections, and reading status.
- A book may be unassigned and cannot occupy multiple locations.
- Deleting a location preserves its books and unassigns their location.
- Assignment directly to a bookcase versus requiring a shelf, and handling child shelves during bookcase deletion, remain open.

The design's Fiction, Nature, To read, and Currently reading cards are not approved physical-location definitions.

## Tags and filtering

Tags are reusable and a book can have several. Owners manage tags and their book assignments. Guests can view and use tag filters, but cannot create, edit, delete, or assign tags.

Each tag has an independent filter choice: not selected, Include, or Exclude. Included and excluded tags are evaluated together in a single search, not as separate search modes. Every included tag must be present (AND); any excluded tag rejects a matching book. Example: include Fantasy and Adventure, exclude Medieval returns only books with both Fantasy and Adventure and without Medieval. A book lacking either included tag is rejected. This behavior is inspired by the supplied Archive of Nethys reference, not its visual design. There is no ANY/OR mode in the confirmed requirements. Final interaction design remains to be discussed.

Removing a tag association or deleting a tag preserves books. Naming normalization, duplicate prevention, and tag-deletion confirmation need definition.

## Lists, search, and sorting

Book and collection listing views are simple listings with simple search, advanced multiple-criteria filtering, and ordering options. The cover-based design is visual direction; final layout choices are not settled here.

- Simple search covers title, authors, ISBN, and collection name.
- Confirmed sort fields: title, date added, and publication date only.
- Author sorting is not included in initial scope.
- Collection details present volumes in their order; volume rules remain to be finalized.
- Exact advanced criteria, combinations, sort direction/defaults, and how fields apply to collection-level results are unresolved.

## Overview

Overview follows the design direction of library counts, recent additions, and location shortcuts. Mockup values are illustrative, not requirements or seed data. Two-state reading status supersedes the currently-reading/progress widgets.

## Audit logs (technical)

Audit logs are required from the first release. Each user-initiated use-case action that changes application state produces a record in the audit logs table: for example, creating a book, updating a book, deleting a tag, or deleting a shelf.

Each record stores its category, a separate Successful/Failed outcome, who performed the action, when it happened, and before/after values as applicable. Failed use-case actions are retained for technical investigation. The actor references the user table; Activity resolves the current username, including for older events after a rename. Password values are explicitly excluded from before/after data. Other credential redaction safeguards are listed in [decisions and open questions](decisions-and-open-questions.md).

Technical authentication events may also be retained, but they must not appear in Activity. Read-only actions, indirect system changes, category definitions, retention, and raw audit-log access still need definition. Failed events must not imply that an attempted change was persisted; exact failure fields and persistence guarantees remain to be agreed. Providing an audit table does not imply a technical-log viewer for every user, undo, or restore.

## Activity (business feature)

Activity tells every user what happened recently in the application. It uses selected audit events and selected fields, rather than exposing the full technical audit logs.

- Example entries: a book was updated, a tag was created, a shelf was deleted.
- Category is the proposed basis for selecting which events appear; exact category mapping remains to be defined and can evolve.
- Only Successful events from the selected categories appear; Failed events remain technical audit records.
- Show the action, who performed it, and when. Do not display before/after values in the initial version.
- Display time relatively, such as '4 days ago' or 'a year ago', with less visual emphasis than the action text.
- Hovering the relative time shows the exact date, time, and acting user's name. The application uses account usernames, not real-name profile fields.
- Authentication events are excluded.

All account roles can view Activity. Initial hiding of before/after values is a presentation rule, not a reason to omit them from the technical record. Keyboard/touch equivalents for hover and timestamp timezone remain open. Username changes use the current user-table value; deleted users retain a deactivated record indefinitely so actor references remain available. Reading goals are deferred.

## Accounts and permissions

The installation has exactly one Admin: the protected first user. All other accounts are Owner or Guest. Only Admin manages other users; Owners and Guests manage only their own account.

| Capability | Guest | Owner | First administrator |
| --- | --- | --- | --- |
| Read shared library | Yes | Yes | Yes |
| Change own reading status | Yes | Yes | Yes |
| Manage own username/password | Yes | Yes | Yes |
| Edit shared books, locations, collections, tags | No | Yes | Yes |
| View loans and receivers | Yes | Yes | Yes |
| Lend books and record returns | No | Yes | Yes |
| Create users | No | No | Yes |
| Assign/change Guest or Owner permissions | No | No | Yes |
| Manage other accounts (including deletion/password reset) | No | No | Yes |
| View Activity | Yes | Yes | Yes |
| Change protected first-administrator account | No | No | Self only |
| Reset all application data | No | No | Yes |

User administration is Admin-only, superseding the earlier broad statement that Owners have all administration features. The exact user-management workflows still need design; Owners cannot administer others or elevate their own permissions.

Deleting a user deactivates the account rather than removing its user-table record. The account can no longer be used, while the record is retained indefinitely to preserve audit actor references and Activity attribution. This retention does not override the full application reset, which removes all other users and audit history. Reactivation, username reuse, and handling existing sessions at deactivation still need definition.

On installation or first start, create the first administrator and require defining a password before normal use. Its username is editable. No other account can modify or delete it. Access restrictions must be enforced beyond merely hiding UI controls.

Reading status is personal: one user's change must not alter another user's status. Its editability is the Guest exception to read-only library access. Ownership and other shared book fields are not personal.

## Local administrator recovery

Accepted approach: trust access to the host computer's operating-system account; require no recovery key or previous application credentials.

- Available before login through Electron's native recovery menu on the host installation.
- Shows the first administrator's username and allows setting a new password.
- Preserves library data and invalidates that administrator's existing sessions.
- Recovery window/resources are bundled locally; the recovery operation has no HTTP endpoint, including localhost.
- Use a narrowly scoped local Electron communication path with validated callers, not browser identification or a spoofable request header.
- Desktop browsers and mobile clients cannot invoke the recovery feature.

Accepted tradeoff: anyone able to use the application under the host OS account can recover administrator access. This does not protect against someone controlling the host machine or modifying its database. A hypothetical Electron client connected to another host must not gain recovery privileges for that host.

## Data reset

Only the first administrator can reset the installation to its initial-data state. Keep its current username and password; delete books, covers, collections, locations, tags, receivers, loans, activity/audit history, other users, and application preferences. The deleted history must not be represented as surviving this reset.

Confirmation UX, session invalidation, treatment of external backups, and operational network settings need definition before implementation.

## Mobile

The same installation serves a deliberately limited mobile interface for collection shopping and adding books by barcode scanning. It is not automatically the full desktop application at a narrower width.

Confirmed shopping rules are consolidated in [Collections and shopping](collections.md): show unfinished collections, compact missing-volume entries, and emphasized highest Owned coverage; require confirmation to mark an eligible ordinary saved record Owned; no quick add for inferred volumes or omnibus books. Guests cannot change shared book data or ownership.

Book-entry/lookup behavior belongs to Task 2. Remaining mobile interaction, empty/error states, and screen refinements belong to Task 6. A separate desktop page mirroring mobile ownership progression remains future scope.
