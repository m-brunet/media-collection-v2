# Features

Status: initial v2 baseline, 2026-10-31. Unresolved details are intentionally identified rather than inferred from v1 or the mockups.

## Books

Owners and the protected first administrator can add, edit, and delete books. Guests cannot change shared book data. Desktop manual creation of a single book is always available, including when lookup fails. Mobile is scan-gated with its own failure rules below.

| Field | Requirement |
| --- | --- |
| Name/title | Mandatory |
| Authors | Mandatory; one or more shared author identities, created/reused by name and linked to books; shared corrections apply everywhere. Exact comparison ignores case, accents, and outer whitespace; similar names prompt a choice |
| ISBN | Required unless the user explicitly selects 'This book has no ISBN'. Accept valid ISBN-10 or ISBN-13 input, convert ISBN-10 to equivalent ISBN-13, and display/use ISBN-13 consistently. Equivalent numbers cannot create duplicate editions. No-ISBN title/author duplicate warnings can be overridden |
| Category | Books, Manga, or Comics; Books is the default |
| Publisher | Optional |
| Publication date | Optional: absent, year only, or month/year; month without year is invalid. No day field |
| Summary | Optional |
| Page count | Optional/null if unknown; positive whole number when supplied |
| Price | Optional/null if unknown; euros only, zero allowed, no negatives, at most two decimal places. Input accepts comma/dot; display uses exactly two decimals for supplied values |
| Cover | Optional, with a neutral fallback when absent; manual selection and automatic lookup supported |
| Ownership | Mandatory shared status: Owned or Not Owned; default Owned |
| Reading status | Mandatory personal status for Owners/Admin: Read or Not read; default Not read. Not shown or editable for Guests |
| Collection membership | Optional; when enabled, collection name and volume number are mandatory |
| Physical location | Optional; at most one location |
| Tags | Multiple reusable tags supported |
| Personal note | Optional free text for Owners/Admin, at most one per book per user; not shared book information. No notes feature for Guests |

Manga includes manga, manhwa, manhua, and related forms. Comics includes Franco-Belgian bandes dessinees, American comics, and graphic novels. Personal ratings are excluded.

The book form has three sections:

1. A visible main block containing mandatory fields/statuses, category, the collection-membership choice, and the optional cover preview/upload control. The cover is always visible inside this first section despite being optional. Collection name and single-volume/consecutive-range coverage become mandatory when membership is enabled. ISBN is required unless the explicit no-ISBN exception is selected.
2. A visible bookcase/shelf assignment and tags block; visibility does not make these optional associations mandatory.
3. An 'Additional information' block, collapsed by default, containing publisher, publication date, summary, page count, and price. Inside it, a new personal free-text note is hidden behind an 'Add a note' button; one note per book per eligible user. If a personal note already exists, opening Additional information shows it directly instead of the Add button.

For a no-ISBN book, possible duplicate detection based on title/authors shows an overridable warning. Personal notes are visible only to their author; other Owners and Admin cannot access their content. The author may delete a note without affecting the book, returning to Add a personal note. Guests have neither notes nor reading-status controls or displays.

On book details, display a small superscript information icon next to the ISBN label when the saved ISBN was converted from ISBN-10. Explain that the displayed ISBN-13 is the equivalent of the supplied ISBN-10 so the change is not mistaken for a bug. Exact explanatory interaction and treatment of later ISBN edits remain screen/book-edit follow-ups; the indicator must reflect an actual conversion, not merely a convertible ISBN-13.

ISBN lookup is an initial feature implemented after lending in the agreed delivery sequence. It starts with an explicit button, checks the existing library first, and redirects to book details if the ISBN is already registered. Otherwise it fills an editable form requiring explicit save confirmation. Fill empty fields; ask before replacing conflicting manual values. Retain incomplete results but require mandatory fields before save. Users choose between multiple usable results/covers. Lookup errors/no results preserve the ISBN and manual completion; show clear feedback distinguishing a known failure from no result. Camera scanning is mobile-only and fills ISBN before the user presses Find book; desktop has no scanning feature. Mobile page details remain Task 6. See [book entry](book-entry.md) for current Task 2 decisions; technical agents investigate providers separately.

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

Task 4 is complete: see [lending business rules](lending.md) and the [design brief](lending-design-brief.md). Owners/Admin manage loans; Guests view them. One active loan per Owned book, reusable name-only receivers, removable starting selection, partial returns, and atomic multi-book operations are confirmed. Lending changes only loan state; keep ownership, shelf, reading, tags, and collection coverage. Block deletion/Not Owned changes during active loans. Show receiver/lending indicators, active loans with lending date, and search by receiver name or book title only. Retain completed history and former title/ISBN after later book deletion; dedicated history UI is future scope. Per-book audit records group into one Activity entry per operation, using household-wide You wording and receiver name.

## Physical locations

- The hierarchy is Bookcase -> Shelf. There is no Room level.
- Locations describe actual storage, independently of tags, collections, and reading status.
- A book may be unassigned and cannot occupy multiple locations.
- Deleting a location preserves its books and unassigns their location.
- Deleting a bookcase removes its shelf definitions and unassigns all affected books, preserving the books themselves.
- Create a bookcase first, then create shelves inside it, using free labels for both. Locations are created on the Bookshelves page before assignment; no inline location creation from a book form initially.
- Assign a book to an existing shelf, never directly to a bookcase. Assignment remains optional, but any assigned book has the full bookcase/shelf context. Display its location as 'Bookcase name - Bookshelf name'.
- Bookcase names are unique across the installation; shelf names are unique within their parent bookcase, using the established name comparison while retaining labels. Renames update all affected displayed locations; name conflicts block renames.
- Shelves may move between bookcases, retaining assigned books. A matching shelf name in the destination blocks the move.
- Empty bookcases/shelves remain available. Before deleting a shelf/bookcase, confirm the affected book count and explain that books become unassigned, not deleted.
- A clickable visual representation of bookcases is future scope. See [locations, tags, search, and ordering](locations-tags-search.md) for Task 3 decisions.

The design's Fiction, Nature, To read, and Currently reading cards are not approved physical-location definitions.

## Tags and filtering

Tags are reusable and a book can have several. Owners manage tags and their book assignments. Guests can view and use tag filters, but cannot create, edit, delete, or assign tags.

Owners/Admin can create a tag directly while editing a book and manage tags from a dedicated interface, reusing equivalent existing names.

Tags are independent identities linked by ID. Renaming updates labels everywhere. Unused tags remain until explicitly deleted. Global deletion requires confirmation with the affected-book count and removes only the tag/assignments, preserving books.

Tag comparison ignores capitalization, accents, and leading/trailing whitespace using the shared name-comparison behavior; equivalent names reuse the tag. The visible label preserves spelling and accents. Comparison normalization must not strip accents from the displayed tag itself.

Each tag has an independent filter choice: not selected, Include, or Exclude. Included and excluded tags are evaluated together in a single search, not as separate search modes. Every included tag must be present (AND); any excluded tag rejects a matching book. Example: include Fantasy and Adventure, exclude Medieval returns only books with both Fantasy and Adventure and without Medieval. A book lacking either included tag is rejected. This behavior is inspired by the supplied Archive of Nethys reference, not its visual design. There is no ANY/OR mode in the confirmed requirements. Final interaction design remains to be discussed.

Removing a tag association or deleting a tag preserves books. Rename to an equivalent existing tag is blocked; merging is future scope. See [Task 3](locations-tags-search.md).

## Lists, search, and sorting

Book and collection listing views are simple listings with simple search, advanced multiple-criteria filtering, and ordering options. The cover-based design is visual direction; final layout choices are not settled here.

- Simple search covers title, authors, ISBN, and collection name, with case/accent-insensitive partial matches and equivalent ISBN-10/13 recognition.
- Confirmed sort fields: title, date added, and publication date only.
- Author sorting is not included in initial scope.
- Collection details present volumes in coverage order under the confirmed collection rules. Collection listings sort by name only, A-Z or Z-A, default A-Z.
- Advanced book filters: category, authors, collection, bookcase/shelf, tags, ownership, and personal reading status; no reading-status filter for Guests.
- Books default to title A-Z; ascending/descending directions are available for title, date added, and publication date. Missing publication dates appear last in both directions.
- Different filter fields combine with AND; multiple selections inside a non-tag field combine with OR. Tags still require every included tag and reject any excluded tag.
- Include explicit No physical location and No collection choices. Simple text search applies together with advanced filters.
- A collection matches book-level search/filters only if at least one member book satisfies the entire expression. Its ownership/completeness counts always cover the whole collection. [Task 3](locations-tags-search.md) is complete, with acceptance examples.

## Overview

Overview shows Owned-book, collection, bookcase/shelf, and currently-lent-book counters, plus recently-added Owned books ordered by record-added date and linking to details. Book counts count saved editions, not collection volumes. Owners/Admin have their own Owned-book Read/Not read summary; Guests have none. Reading goals/in-progress widgets are excluded. Count values derive from actual data. Remaining interaction details are tracked in [Task 6](overview-activity-mobile.md).

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
- Main Activity wording uses 'You' collectively for the household, even when another account performed the action. This is not viewer-relative wording; preserve actual actor attribution in audit records and timestamp details.
- Display time relatively, such as '4 days ago' or 'a year ago', with less visual emphasis than the action text.
- Hovering the relative time shows the exact date, time, and acting user's name. The application uses account usernames, not real-name profile fields.
- Authentication events are excluded.
- Include successful shared changes to books, authors, collections, locations, tags, and lending. Exclude account/security events and private note/reading-status changes from Activity, without waiving technical auditing.
- No category or date-range filters initially. Categories select eligible events internally, not through an initial filtering interface.
- Show newest entries first and allow loading older entries.

All account roles can view desktop Activity. Initial hiding of before/after values is a presentation rule, not a reason to omit them from the technical record. Exact timestamp details use hover; added click/tap/focus-reveal interactions were declined initially. Timestamp timezone remains to be specified as a display convention. Username changes use the current user-table value; deactivated users remain available for attribution. Reading goals are deferred.

## Accounts and permissions

The installation has exactly one Admin: the protected first user. All other accounts are Owner or Guest. Only Admin manages other users; Owners and Guests manage only their own account.

| Capability | Guest | Owner | First administrator |
| --- | --- | --- | --- |
| Read shared library | Yes | Yes | Yes |
| View/change own reading status | No | Yes | Yes |
| Use own personal book note | No | Yes | Yes |
| Manage own username/password | Yes | Yes | Yes |
| Edit shared books, locations, collections, tags | No | Yes | Yes |
| View loans and receivers | Yes | Yes | Yes |
| Lend books and record returns | No | Yes | Yes |
| Create users | No | No | Yes |
| Choose Guest/Owner role when creating an account | No | No | Yes |
| Change an account's role after creation | No | No | No |
| Manage other accounts (including deletion/password reset) | No | No | Yes |
| View Activity | Yes | Yes | Yes |
| Change protected first-administrator account | No | No | Self only |
| Reset all application data | No | No | Yes |

User administration is Admin-only, superseding the earlier broad statement that Owners have all administration features. There is no registration/sign-up feature: Admin creates later users and chooses Guest or Owner at creation. Owners cannot administer others or elevate their own permissions. See [accounts](accounts.md) for Task 5 decisions and remaining password workflows.

Roles are fixed at creation; no upgrade/demotion is available, including to Admin. Only Admin deactivates/reactivates other accounts; users cannot deactivate themselves. The protected Admin cannot deactivate, delete, or demote itself, but can still edit its own username/password. This supersedes earlier Admin role-change permission.

Admin sets a temporary password when creating a later account or resetting another user's password. That user must choose a replacement at first/next login before normal use; no email workflow is introduced.

Deleting a user deactivates the account rather than removing its user-table record. Immediately end existing sessions and prevent login, while retaining the record indefinitely for audit/Activity attribution. Keep its current username reserved. Admin may reactivate with the same fixed role and retained personal data. An active rename releases the former name for reuse without transferring data or attribution. The authenticated Admin-settings data reset keeps Admin's current username/password; there is no pre-login factory reset. [Task 5](accounts.md) is complete with acceptance examples.

On first launch, immediately present the administrator-password setup form and require completion before normal use. Its username is editable. No other account can modify or delete it. This installation setup is not public registration. Access restrictions must be enforced beyond merely hiding UI controls.

Reading status and notes are personal features for Owners/Admin: one user's changes must not alter another user's data. Guests are read-only for books, with no reading-status display or note feature; this supersedes the earlier Guest reading-status exception. Guests may manage their own account. Ownership and other shared book fields are not personal. A Guest may be a friend in real life, but Guest accounts and lending receivers must have no application link or automatic matching.

New Owners start with all existing books Not read. Each new book starts Not read independently for every Owner/Admin.

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

The same installation serves a deliberately limited mobile interface for collection shopping and adding books by barcode scanning. Its home page has Collections and Scan buttons. Mobile book entry uses the same three form sections and field rules as desktop, adapted to the phone. Successful creation offers Scan another book or Back to home. It is not automatically the full desktop application at a narrower width.

Mobile is Owner/Admin-only; Guests have no access. Add-form access requires a successful scan, with no manual ISBN-entry fallback. Camera/scan failure offers an explanation, Retry, or Back to home. Desktop manual entry is unchanged. Unsaved changes require discard confirmation; failed saves preserve the form with error feedback/retry and do not show success navigation.

Mobile metadata lookup failure permits at most one retry, then error and Back to home with no manual completion. Existing Owned ISBN shows Already owned with scan-again/home choices; existing Not Owned ISBN requires confirmation before external fetching and updates the existing record rather than creating a duplicate. The local ISBN check always comes first. The single retry uses an explicit Retry button, never an automatic retry. [Task 6](overview-activity-mobile.md) is complete with acceptance examples and final flow rules.

Confirmed shopping rules are consolidated in [Collections and shopping](collections.md): show unfinished collections, compact missing-volume entries, and emphasized highest Owned coverage; require confirmation to mark an eligible ordinary saved record Owned; no quick add for inferred volumes or omnibus books. Guests cannot change shared book data or ownership.

Book-entry/lookup behavior belongs to Task 2. Remaining mobile interaction, empty/error states, and screen refinements belong to Task 6. A separate desktop page mirroring mobile ownership progression remains future scope.
