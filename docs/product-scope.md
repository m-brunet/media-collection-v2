# Product scope

Status: product baseline reconciled after Tasks 1-7 and the application-update discussion. This is a requirements document, not a claim of implemented behavior. [Application updates](updates.md) defines GitHub Releases distribution, Windows integrated installation, and manual macOS/Linux installation with backup assistance.

## Purpose

Media Collection v2 helps people manage books in their home, locate them on physical shelves, organize related books into collections, and identify collection books to buy while shopping.

Managing books the user actually owns is the primary workflow. Pre-registering Not Owned books is supported but expected to be extremely rare, not a wishlist/catalogue-planning focus. Ownership-conflict handling should protect data with clear confirmations without dominating the interface or expanding initial scope.

The product is named Media Collection; its desktop web interface is Libris and its mobile web interface is Leaf. See [design guidelines](design-guidelines.md) for naming and display rules.

The audience includes people without technical or security knowledge. Forms should remain approachable, including when optional metadata is available.

One installation holds one shared library. Multiple accounts access it; there are no separate per-user libraries. Reading status and optional book notes are personal features for Owners/Admin. Guests have neither notes nor a reading-status display; they may view library data and manage their own account. User accounts do not request email addresses, real names, or civility; accounts use usernames and passwords. Guest accounts have no application link to lending receivers.

Lending introduces an explicit exception for receiver names: a receiver is stored by name only, separately from user accounts. No additional contact or identity fields are requested. See [lending](lending.md).

## Foundation and access

- Foundation: electron-base-app, currently located at `E:/repos/electron-base-app/electron-based-app`.
- Electron desktop and desktop browser offer the same normal business functionality. Local maintenance actions are the explicit exception.
- Administrator credential recovery and manual backup/restore are exclusive to local Electron maintenance on the library host, not browser/mobile features.
- An Owner/Admin-only mobile web interface (Leaf) is served by the same installation for unfinished-collection shopping and scan-gated book creation; Guests have no mobile access. Libris (desktop) and Leaf (mobile) are separate web applications on the same host and port: Libris at `/`, Leaf at `/leaf/`.
- Internet access to the installation is expected, with user-configured port forwarding anticipated.
- The listening port must be available and between 1024 and 65535 inclusive, so ports 80 and 443 are not permitted. The default port is 34345.
- Core desktop management works offline; external lookup requires internet. Mobile shopping works while it can reach the host, with no separate offline mobile sync implied. Transport/security/deployment mechanisms remain technical-agent work.

## Initial feature scope

- Book creation, editing, and deletion, with desktop manual entry always available; mobile creation requires successful scanning/lookup and has no manual failure fallback.
- ISBN metadata lookup as a priority feature; manual and automatic cover selection.
- Camera barcode scanning is mobile-only; its agreed home/scan/lookup/form/failure paths are in [mobile experience](overview-activity-mobile.md).
- Books, Manga, and Comics categories; Books is the default.
- Shared ownership status and personal two-state reading status for Owners/Admin, not Guests.
- Optional author-only personal free-text note for Owners/Admin, one per book per user, behind an Add control inside collapsed additional information. Existing notes appear when opened; authors can delete them without affecting the book. Other Owners/Admin cannot read their content.
- One record per edition, unique ISBN when supplied, and support for books without ISBNs. Status defaults are Owned and Not read.
- Physical bookcases and shelves, with optional book location assignment.
- Integer-numbered collections, inferred missing volumes without manual enumeration, ownership visibility, and explicit Finished status.
- Reusable tags and inclusion/exclusion filtering.
- Simple search, advanced multiple-criteria filtering, and selected sort options.
- Overview and book/collection/location views following the [design guidelines](design-guidelines.md).
- An installation-wide colour scheme chosen by Admin (Spring green by default, or Mint, Emerald, Forest). See [design guidelines](design-guidelines.md).
- An installation-wide icon set chosen by Admin in application settings, Lucide by default, with a credits/licences page for bundled third-party assets. See [design guidelines](design-guidelines.md).
- Technical audit logs for user-initiated use-case changes from the first release, with category, actor, timestamp, and before/after values excluding passwords. A distinct Activity feature presents selected events to all users, with actor and relative time but no before/after values initially; authentication events stay out of Activity.
- Audit outcome is Successful or Failed, independently of category. Activity shows only successful eligible events and resolves the actor's current username from the user table.
- Account management, permissions, local first-administrator recovery, and first-administrator data reset.
- Lending one or several books to a named receiver, partial/multi-book returns, and an active-loan page with dates and receiver/title search; confirmed rules are in [lending](lending.md).
- English and French interface support, with an independent preference for each user.
- Local Electron-maintenance-only manual full-data backup/restore, including users, personal data, history, covers, and saved settings. Same-version restore supports another computer, replaces without merging, preserves backed-up credentials, and ends sessions. Local Admin recovery remains the failsafe; invalid/incompatible/failed restore preserves current data.

Tasks 1-7 have confirmed business rules and acceptance examples in their owning documents. [Decisions and handoff](decisions-and-open-questions.md) separates that baseline from technical/design follow-ups and explicit deferrals. Application implementation has not begun beyond the unchanged foundation import.

## Deferred or excluded

- Reading goals: future idea only, not requested or approved for initial scope.
- Personal ratings: excluded.
- Reading-in-progress status: excluded; only Read and Not read are confirmed.
- Dedicated collection creation that generates several Not Owned book records: future idea for discussion.
- A separate desktop page mirroring mobile collection ownership progression: future feature for discussion, distinct from initial desktop collection details.
- Clickable visual representations of physical bookcases: future feature; initial bookcase/shelf hierarchy and shelf assignment do not require them.
- Configurable currency: possible future feature; initial book prices use euros only.
- Importing v1 MongoDB dumps: future one-off migration/script for the sole v1 user, not an initial reusable import interface.
- Automatic/scheduled backups: future scope; initial backup/restore is manual.
- Cross-version backup restoration: future scope; initial restoration requires the same MC version.
- A dedicated returned-loan history interface: future scope; completed records are retained, while the initial lending interface shows active loans.
- Movies, DVDs, and other non-book media: excluded for the foreseeable future.
- Separate Lists feature: not requested; do not add alongside tags by inference.
- Reusing v1 code, v1's entire feature set, or demo content as application data: not authorized.
- Automatic inclusion of v1 account recovery, custom fields, duplication, or metadata providers: not implied by historical research.

## Reference authority

1. Latest explicit user decisions, reflected in these v2 documents.
2. The Libris design artifact described in [design guidelines](design-guidelines.md), as a guide for style and layout only, not an exhaustive or pixel-perfect specification.
3. v1 repositories as historical context only.

No database schema, external metadata provider, or final UI interaction design has been selected by these documents.
