# Decisions and open questions

Baseline: 2026-10-31. Confirmed requirements live in [features](features.md) and [scope](product-scope.md). Recommendations below have not been accepted unless explicitly stated.

## Confirmed choices and reasons

- Books only, with Books/Manga/Comics categories: v1's broader media scope does not carry over.
- Separate location, collection, tags, ownership, and personal reading status: each expresses a different concept.
- Read/Not read only: no in-progress status or reading-goal requirement inferred from the drawings.
- Explicit Finished collections: a series may resume; a final-volume flag does not determine mobile visibility.
- Audit history from initial release: capture early changes rather than attempting to reconstruct lost history later.
- One shared library, individual accounts: reading status is personal; other library data is shared.
- First administrator protection: user creation and permission assignment are reserved to it.
- Exactly one Admin, the first user; all management of other accounts is reserved to it. Owners and Guests manage only themselves.
- User deletion deactivates the account and retains its user-table record indefinitely for audit references. Full application reset still removes other users and audit history.
- One catalogue record per edition; enforce uniqueness of supplied ISBNs and allow exceptions for books without ISBNs.
- Ownership defaults to Owned; per-user reading status defaults to Not read.
- Integer volumes only; infer missing volumes without manual enumeration. A collection-level volume-0 option is proposed.
- Every tag can independently be included or excluded in the same search. All included tags must be present (AND), and no excluded tag may be present.
- Audit user-initiated use-case changes in a technical table with category, actor, timestamp, and before/after values, excluding passwords. Activity is a separate business feature for all users, showing selected actions, actor, and relative time, without before/after values initially. Authentication events stay out of Activity.
- Local credential recovery without a key: accessibility for nontechnical users, accepting the host OS account as the trust boundary.
- Internet access expected: do not assume home-network-only deployment.
- Design covers are mockup references only and must never become production application assets.

## Audit history: confirmed scope and implementation recommendations

Additional confirmed rules: a Successful/Failed outcome is separate from category. Failed use-case actions remain in audit logs; Activity selects only successful events from its allowed categories. Audit actors reference the user table, and Activity shows the current username rather than a historical name snapshot.

Starting now is appropriate: complete historical state cannot be reconstructed if the original changes were never recorded. Keep the technical event history separate from its user-facing Activity presentation so the latter can evolve without discarding events.

Confirmed: user-initiated use-case changes create audit-table records with category, actor, timestamp, and before/after values as applicable, excluding passwords. Activity is a separate presentation of selected events/fields for everyone; it is not raw audit-log access. It initially omits before/after data and shows the action, actor, and relative time with less visual emphasis. Hovering the time shows the exact date, time, and username. Category-based selection is proposed. Authentication events may be retained technically but are excluded from Activity.

Recommended implementation safeguards:

- Record use-case outcomes with event ID, timestamp, actor, action, category, outcome, entity ID/type, and relevant before/after values. Associate automatic changes with their initiating action.
- Keep the mutation and its audit event consistent so a successful change cannot silently lose its history.
- For failures, record a safe error code/reason; do not describe attempted values as persisted after-state. Retain failure records independently of the rolled-back mutation. Exact failure payload and persistence mechanics remain recommendations for discussion.
- Password-value exclusion is confirmed. Also exclude password hashes, tokens, cookies, and recovery material. Record credential changes as events without credential values.
- Decide which authentication events to retain technically, and whether read-only actions or indirect system changes need records. Unauthenticated events cannot always reference an identified user; define their actor representation. Do not log request bodies indiscriminately.
- Do not store full cover image binaries in every event; define references and deletion behavior.
- Prevent ordinary UI users from rewriting history. Do not promise tamper-proof evidence against someone controlling the host/database.
- Specify retention, redaction, and raw technical-log visibility, particularly personal reading-state and account events. Full data reset intentionally removes history.

The scope above is accepted; the safeguards and exact consistency guarantees still need agreement before implementation.

## ISBN: fact and product policy are different

ISBN identifies a title's particular edition and format, not an individual physical copy. Two copies of the same edition can share an ISBN. Different formats/editions generally have different ISBNs. ISBN-10 and its corresponding ISBN-13 can refer to the same publication.

Sources: [International ISBN Agency: What is an ISBN?](https://www.isbn-international.org/index.php/content/what-isbn/10), [ISBN.org: standard and conversion](https://www.isbn.org/about_ISBN_standard).

Accepted policy: one catalogue record per edition, enforcing ISBN uniqueness when supplied. Books without ISBNs are allowed as an exception. This is a product restriction, not proof that no duplicate physical copies exist.

Recommendation: accept valid ISBN-10 and ISBN-13, normalize equivalent identifiers for duplicate checks, and use a stable internal record ID so correcting an ISBN does not change identity. Format/normalization rules and duplicate-edition detection without ISBN still need confirmation. Multiple physical copies are not separately represented under the accepted one-record policy.

## Questions to resolve

### Book entry and metadata

1. How should duplicate editions be detected for books without an ISBN? One record per edition and no-ISBN exceptions are confirmed.
2. Confirm ISBN formats, validation, and normalization. What happens when scanning an ISBN already in the library, especially a Not Owned record?
3. Defaults are confirmed as Owned and Not read; define their application to new-user/existing-book combinations (see question 19).
4. Select metadata and cover providers after discussing coverage, reliability, costs, and edition matching. Define result review and missing/failed lookup behavior.
5. Is a cover optional? Is a personal note included, and is it shared or per-user? Which optional fields are initially hidden?
6. Define similarity-warning behavior without preventing legitimate distinct authors with similar names. Are authors managed as reusable entities, and how are names corrected across books?
7. Define price currency/precision and publication-date precision if needed for the initial form.

### Collections and shopping

8. Confirm inferred missing volumes: from 1 through the highest registered volume, including both absent records and Not Owned records? Users must not have to enumerate expected books.
9. Confirm a collection-level 'includes volume 0' option (default off?), making the inferred range start at 0. Is owning every inferred volume sufficient to permit Finished?
10. How does a newly published volume become known? Finished cannot automatically reopen for an unknown publication.
    If the highest registered volume is deleted, should the collection retain its previously known upper bound? Otherwise recalculating solely from remaining records could hide that newly missing volume and fail to reopen a Finished collection.
11. Are integer volume numbers unique within a collection, even for different editions? Fractional numbers are excluded. How are unnumbered specials handled, if supported?
12. Should 'last owned' mean the highest Owned volume number? Can shopping users mark a book Owned, and which permissions apply?
13. Can users create empty collections initially? What happens when deleting a collection? Bulk generation of Not Owned records remains deferred.

### Locations, tags, and listings

14. Must location assignment target a shelf, or may it target a bookcase? Does deleting a bookcase delete its child shelf definitions and unassign all affected books?
15. Independent Include/Exclude per tag and AND across included tags are confirmed. Can tag rules be combined with other advanced criteria? Final filter interaction design remains open.
16. Confirm tag naming/normalization and destructive-action confirmations. The Nethys screenshot specifies behavior, not a UI design.
17. Confirm the advanced filter fields. Confirm sort defaults/directions, missing publication-date ordering, and how title/date sorting maps to collection-level lists.

### Accounts, history, and deployment

18. Admin is confirmed as the sole protected first user, exclusively managing other accounts. Define user deletion and password-reset workflows and whether self-deletion is permitted; do not infer that Admin may delete the protected account.
19. Deleted users retain a deactivated user-table record indefinitely for audit references. Define retention of their personal reading status, reactivation, username reuse, and existing-session handling. What defaults apply to new users on existing books and existing users on new books?
20. Technical audit logs and Activity are distinct. Define categories and their Activity mapping, additional credential redaction, audit-event retention, timezone, authentication-event/read-only action coverage, and whether any raw technical-log viewer is needed (and for whom). Successful/Failed outcomes, current username display via the user table, and indefinite retention of deactivated user records are confirmed. Define unauthenticated actors, failure payloads, and keyboard/touch equivalents for timestamp hover. Activity is visible to everyone, includes only successful eligible events, and initially excludes before/after values.
21. Which Overview statistics remain useful after removing reading progress/goals? Are there dedicated Activity filters?
22. Define first-run setup access so an internet visitor cannot claim an unconfigured installation. Define HTTPS/TLS, session handling, port setup, and offline requirements before external exposure.
23. Define reset confirmation, session invalidation, backup treatment, and whether network settings must be configured again after application preferences are erased.
24. Confirm initial UI language(s); English/French category labels were discussed, but a translation scope was not approved.

## Design reconciliation

The handoff originated in a directory named Media collection v3, but these documents define v2. Mockup names, counts, example books, and branding are not authoritative product data.

Retain the dark, cover-focused visual direction. Adapt shelf cards to physical Bookcase/Shelf locations. Add the agreed tag editing/filter behavior. Remove ratings, in-progress reading widgets, and reading goals from initial scope. Preserve independent ownership and personal reading state. Keep the add form light; its final optional-field arrangement needs design discussion.

The original handoff did not inspect electron-base-app or select a database/schema. It must not override the chosen foundation or prescribe implementation architecture.
