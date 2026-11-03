# Overview, Activity, and mobile experience

Status: Task 6 product decisions complete. Confirmed behavior and acceptance examples below supersede contradictory design widgets; this is not an implementation plan. The design artifact is a style guide; see [design guidelines](design-guidelines.md).

## Overview

Show counters for Owned books, collections, bookcases/shelves, and currently lent books. Owned book counts represent saved edition records, not distinct collection volume numbers; omnibus books remain one book. Do not count inferred volumes as books.

Include a short recently-added list of Owned books only, ordered newest first by when their records were added, with links to book details. Do not substitute the date of an ownership change for record-added date. Precise visual capacity is a design refinement, not fixed demo data.

Owners/Admin see their own Read/Not read summary counting Owned books only. Not Owned records do not enter these totals. Guests have no reading summary or other personal reading display. There are no reading goals or in-progress states.

All displayed counts derive from actual data rather than the illustrative values in the exported design.

## Shared Activity

Initially include successful shared changes to books, authors, collections, physical locations, tags, and lending. Exclude account/security events and private note/reading-status changes. These exclusions concern Activity presentation, not the technical audit requirement.

There are no category or date-range filters initially. Do not add them by inference from the audit category system.

Preserve the previously confirmed presentation:

- Activity is visible to all account roles.
- Main wording uses You for the household, regardless of the acting account or viewer.
- Show relative time with less emphasis than the action; timestamp details reveal exact date/time with its time-zone label and the actor's current username.
- Store timestamps in UTC and display dates/times in each viewer's own time zone, formatted for the viewer's chosen language. The same rule applies to every displayed date, including lending dates.
- Do not show before/after values initially.
- Group a lending/return operation into one Activity entry, while retaining its per-book technical audit records. Receiver names may appear.
- Never expose personal-note contents through this shared view.

Show Activity newest first and provide a way to load older entries. Pagination/load-more mechanics are implementation/design choices, not an added filtering feature. Exact timestamp/actor details appear on hover and on keyboard focus (accessibility baseline in [design guidelines](design-guidelines.md)); click/tap reveal is not required.

## Mobile baseline from completed tasks

The same installation serves a separate limited mobile web application, Leaf, at `/leaf/` (Libris, the desktop interface, is at `/`): unfinished-collection shopping and mobile-only barcode scanning/book entry. It is not the desktop interface merely shrunk to a phone width.

Follow [collection shopping rules](collections.md), [book-entry rules](book-entry.md), and [account permissions](accounts.md). These establish compact volume entries, highest Owned coverage, existing-record quick-add confirmation, no omnibus quick add, explicit scan-to-ISBN lookup button, and editable result review. Mobile access is restricted to Owners/Admin: Guests cannot access the mobile interface at all, including shopping. This supersedes the earlier Guest read-only mobile-shopping assumption; their desktop read access is unchanged. No mobile lending workflow is approved.

### Mobile home and book form

Provide an Owner/Admin mobile home with two main buttons: Collections and Scan. Collections opens shopping; Scan starts scanning. Do not create a Guest mobile home or grant access through a direct mobile link.

Mobile book entry keeps the same three sections and field rules as desktop, adapted to the phone screen: main information/cover, location/tags, and collapsed optional information with the additional personal-note control. Do not invent a reduced mandatory-field set for mobile.

The mobile add form is accessible only after a successful scan. No manual ISBN-entry alternative or direct manual add route is offered on mobile. If the camera is unavailable or scanning fails, explain the issue and offer Retry or Back to home only. Desktop manual entry remains available; the general manual-entry requirement does not bypass the mobile scan gate.

After successful book creation, show success and offer Scan another book or Back to home. The latter returns to mobile home, not directly to Collections. Do not show creation success after failed saves or for an already-existing book.

### Lookup and existing ISBNs after scanning

After a successful scan, keep lookup explicitly user-triggered as already agreed. The library ISBN check precedes any external metadata fetch.

- Existing Owned book: show Already owned with Scan another book / Back to home. Do not offer duplicate creation.
- Existing Not Owned book: show confirmation after successful scanning and the existing-ISBN check. Confirming opens the existing record for review/update and ownership confirmation, not another creation. No external metadata lookup is performed in this flow, before or after the confirmation; the existing metadata is used.
- New ISBN: retrieve data and review the result under the shared book-field rules. Mobile still does not allow entering an ISBN without a successful scan.
- Failed mobile metadata lookup: after the first failure show a Retry button. Retry only when the user presses it, at most once (two total attempts in that lookup flow); do not retry automatically. After the retry fails, show an error and Back to home, with no further retry or manual-entry fallback. This is a mobile exception to desktop manual completion on lookup failure.

### Form feedback

Ask before discarding entered unsaved changes when navigating away or cancelling. On save failure, preserve the draft, explain the failure, and allow retry. Success feedback/navigation choices appear only after a confirmed save. These rules apply to the already-approved forms, not a new autosave or draft-history feature.

Do not treat undrawn screens as permission to invent additional features. Existing-ISBN and mobile failure rules above take precedence over generic desktop fallback/redirect behavior.

## Screen reconciliation and required feedback

The design artifact is a style guide, not proof that every current requirement is drawn. Implement the confirmed counters, actual bookcase/shelf locations, personal Owned-book Read/Not read summary (never shown to Guests), lending dates, title/receiver-only search, and removable starting selection as specified here.

The design artifact includes Leaf screens for this home -> shopping or scan -> ISBN/button -> lookup/review -> confirmed save flow, with existing-record and failure branches; these rules take precedence where a drawn screen differs. Do not add mobile Guest pages, lending pages, a manual-entry route, or Activity by inference.

Already-required states must be represented during design/implementation: loading; empty library/locations/collections/loans/Activity; empty search results; field validation; unavailable lookup/camera; permission denial; ownership/loan conflicts; unsaved-discard confirmation; save failure with preserved draft; and confirmed success. Exact component layout and copy are design work, not authorization for new business features.

First-launch Admin setup, login/temporary-password replacement, self-account settings, Admin user management, and local recovery screens must follow [accounts](accounts.md). Detailed visual treatment can be produced from these business requirements without reopening roles or exposing desktop recovery to browsers.

## Acceptance examples

1. Overview counts saved Owned editions, not inferred volumes or covered-volume totals; an omnibus is one book. Collection/location/active-loan counters use actual data.
2. Recently added lists Owned books by record-added date and links to details. Personal Read/Not read counts include only Owned records for the current Owner/Admin; Guests see no reading summary.
3. Activity shows newest eligible successful shared events first and can load older entries, without category/date filters or before/after data.
4. Account/security and personal reading/note events are absent from shared Activity. Lending batches produce one household-You entry while retaining actual actor details in audits/timestamp hover.
5. Guest attempts mobile access: denied, not a read-only mobile home. Desktop Guest read access is unchanged.
6. Owner/Admin mobile home offers Collections and Scan. Shopping follows the completed collection rules, including compact missing entries and confirmed quick add only for eligible saved ordinary records.
7. No successful scan: mobile add form is unavailable. Camera/scan failure explains the issue and offers Retry or Back to home, with no manual ISBN alternative.
8. Successful new-ISBN scan: fill ISBN; only pressing Find book begins the lookup. The editable phone form keeps the same three sections/field rules as desktop.
9. Existing Owned ISBN: show Already owned and Scan another book / Back to home; no duplicate creation.
10. Existing Not Owned ISBN: request confirmation, reuse the existing book for review/update without any external lookup, and change ownership only after confirmation.
11. Initial mobile lookup fails: show Retry. One user-triggered retry is allowed; a second failure shows error/Back to home, with no manual completion or further retry.
12. Desktop lookup fails: the previously confirmed desktop manual-completion fallback remains available; do not apply the mobile limitation globally.
13. User leaves/cancels a changed form: ask before discarding. Save failure keeps the form and offers retry, without displaying creation success.
14. Successful mobile creation: show success with Scan another book or Back to home; no automatic next-book creation or forced Collections destination.

## Assigned follow-ups

Task 7 handles release languages/offline/backup/reset expectations. Undrawn mobile/account/feedback states are built in the established style from the closest design pattern. Technical agents choose pagination, provider integration, routing/role enforcement, draft handling, and other implementation mechanisms without adding product workflows. Click/tap timestamp reveal is not required; keyboard focus reveal is required for accessibility.
