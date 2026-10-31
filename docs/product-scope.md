# Product scope

Status: initial product baseline, 2026-10-31. This is a requirements document, not a claim of implemented behavior.

## Purpose

Media Collection v2 helps people manage books in their home, locate them on physical shelves, organize related books into collections, and identify collection books to buy while shopping.

The audience includes people without technical or security knowledge. Forms should remain approachable, including when optional metadata is available.

One installation holds one shared library. Multiple accounts access it; there are no separate per-user libraries. Reading status is personal to each user. User accounts do not request email addresses, real names, or civility; accounts use usernames and passwords.

Lending introduces an explicit exception for receiver names: a receiver is stored by name only, separately from user accounts. No additional contact or identity fields are requested. See [lending](lending.md).

## Foundation and access

- Foundation: electron-base-app, currently located at `E:/repos/electron-base-app/electron-based-app`.
- Electron desktop application and desktop browser offer the same normal functionality.
- Administrator credential recovery is exclusive to the Electron application on the library host.
- A simplified mobile web interface is served by the same installation. Its purposes are shopping assistance for unfinished collections and adding books by camera barcode scanning.
- Internet access to the installation is expected, with user-configured port forwarding anticipated.
- The listening port must be available and greater than 1024; ports 80 and 443 are not permitted. No default port is selected yet.
- Offline requirements, transport security, deployment details, and network setup experience still need definition.

## Initial feature scope

- Book creation, editing, and deletion, with manual entry always available.
- ISBN metadata lookup as a priority feature; manual and automatic cover selection.
- Books, Manga, and Comics categories; Books is the default.
- Shared ownership status and per-user two-state reading status.
- One record per edition, unique ISBN when supplied, and support for books without ISBNs. Status defaults are Owned and Not read.
- Physical bookcases and shelves, with optional book location assignment.
- Integer-numbered collections, inferred missing volumes without manual enumeration, ownership visibility, and explicit Finished status.
- Reusable tags and inclusion/exclusion filtering.
- Simple search, advanced multiple-criteria filtering, and selected sort options.
- Overview and book/collection/location views based on the supplied visual direction.
- Technical audit logs for user-initiated use-case changes from the first release, with category, actor, timestamp, and before/after values excluding passwords. A distinct Activity feature presents selected events to all users, with actor and relative time but no before/after values initially; authentication events stay out of Activity.
- Audit outcome is Successful or Failed, independently of category. Activity shows only successful eligible events and resolves the actor's current username from the user table.
- Account management, permissions, local first-administrator recovery, and first-administrator data reset.
- Lending one or several books to a named receiver, recording partial or multi-book returns, and a page listing lent books and receivers. Detailed open rules are tracked in [lending](lending.md).

Some initial-scope features have unresolved rules; see [open questions](decisions-and-open-questions.md). Scope inclusion does not settle those details.

## Deferred or excluded

- Reading goals: future idea only, not requested or approved for initial scope.
- Personal ratings: excluded.
- Reading-in-progress status: excluded; only Read and Not read are confirmed.
- Dedicated collection creation that generates several Not Owned book records: future idea for discussion.
- Notes and progressive disclosure of optional fields: under consideration, not a settled form specification.
- Movies, DVDs, and other non-book media: excluded for the foreseeable future.
- Separate Lists feature: not requested; do not add alongside tags by inference.
- Reusing v1 code, v1's entire feature set, or demo content as application data: not authorized.
- Automatic inclusion of v1 account recovery, custom fields, duplication, or metadata providers: not implied by historical research.

## Reference authority

1. Latest explicit user decisions, reflected in these v2 documents.
2. Confirmed concepts from the design handoff, as reconciled here.
3. Selected screenshots and HTML as visual references only.
4. v1 repositories as historical context only.

No database schema, external metadata provider, or final UI interaction design has been selected by these documents.
