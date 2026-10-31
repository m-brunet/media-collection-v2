# Decisions and open questions

Baseline: 2026-10-31. Confirmed requirements live in [features](features.md) and [scope](product-scope.md). Recommendations below have not been accepted unless explicitly stated.

## Confirmed choices and reasons

- Books only, with Books/Manga/Comics categories: v1's broader media scope does not carry over.
- Separate location, collection, tags, ownership, and personal reading status: each expresses a different concept.
- Read/Not read only: no in-progress status or reading-goal requirement inferred from the drawings.
- Explicit Finished collections: a series may resume; a final-volume flag does not determine mobile visibility.
- Audit history from initial release: capture early changes rather than attempting to reconstruct lost history later.
- One shared library, individual accounts: reading status and optional notes are personal for Owners/Admin; shared book metadata is common. Guests have no reading-status or notes features, superseding the earlier reading exception. Guest accounts and lending receivers have no application link.
- First administrator protection: user creation and initial Guest/Owner role selection are reserved to it; roles cannot change afterward.
- Exactly one Admin, the first user; all management of other accounts is reserved to it. Owners and Guests manage only themselves.
- User deletion deactivates the account and retains its user-table record indefinitely for audit references. Full application reset still removes other users and audit history.
- One catalogue record per edition; enforce uniqueness of supplied ISBNs and allow exceptions for books without ISBNs.
- Ownership defaults to Owned; per-user reading status defaults to Not read.
- Integer volumes only; infer missing volumes without manual enumeration. A collection-level 'Includes volume 0' checkbox is off by default. Deleting the highest volume recomputes the inferred range from remaining books rather than retaining the old upper bound.
- Every tag can independently be included or excluded in the same search. All included tags must be present (AND), and no excluded tag may be present.
- Audit user-initiated use-case changes in a technical table with category, actor, timestamp, and before/after values, excluding passwords. Activity is a separate business feature for all users, showing selected actions, actor, and relative time, without before/after values initially. Authentication events stay out of Activity.
- Local credential recovery without a key: accessibility for nontechnical users, accepting the host OS account as the trust boundary.
- Internet access expected: do not assume home-network-only deployment.
- Design covers are mockup references only and must never become production application assets.
- Delivery sequencing is agreed at product level: access/accountability, core library, organisation, lending/returns, assisted entry, mobile, then Overview/Activity presentation. Audit capture starts with the first implemented changes; assisted entry is required but deliberately follows lending.
- Resolve outstanding product topics one at a time through discussion, document confirmed rules and acceptance examples, then close each topic before proceeding. Explicit deferrals are distinguished from unresolved initial-scope behavior. Technical implementation choices are delegated separately.
- Commit each completed clarification task's documentation before starting the next task's questions. Working plans remain local in ignored `.plans/`; product decisions remain versioned. Pushing is a separate action.

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

Accepted ISBN behavior: accept valid ISBN-10 and ISBN-13 input, automatically convert ISBN-10 to equivalent ISBN-13, and display/use ISBN-13 consistently. Equivalent identifiers cannot create duplicate editions. On book details, a small superscript information icon beside the ISBN label explains an actual ISBN-10 conversion. The technical recommendation to keep stable internal record identity is separate from this product decision. No-ISBN title/author duplicate warnings are overridable. Multiple physical copies are not separately represented under the accepted one-record policy.

## Questions to resolve

### Book entry and metadata - Task 2 complete

The confirmed rules and acceptance examples are consolidated in [Book entry](book-entry.md). They cover the form blocks, ISBN-10/13 equivalence and conversion indicator, explicit no-ISBN exception, optional cover, author matching/lifecycle, private notes and Guest restrictions, month/year dates, euro price/null/free distinction, page counts, explicit lookup and existing-record redirect, manual draft preservation, result selection, and visible failure/manual fallback.

Mobile scanning is not available on desktop. Its agreed handoff is scan to ISBN then explicit Find book; detailed pages and interaction refinements belong to Task 6. Account-role transitions belong to Task 5. Provider choice, matching mechanics, and enforcement are technical-agent work, not unanswered product decisions.

### Collections and shopping ? Task 1 complete

The final rules and acceptance examples are in [Collections and shopping](collections.md). They supersede the earlier collection discussion questions and proposals. The [edition impact analysis](collection-editions-impact.md) summarizes counting and duplicate-prevention implications.

Confirmed: volume-0 option, inferred range through highest saved coverage, shrinkage on deletion, distinct-volume counts, consecutive omnibus ranges, Finished lifecycle, collection creation/rename/deletion, overlap restrictions and explicit conflict resolution, and compact mobile shopping/quick-add behavior. Rename to an existing collection name is blocked; merging is future scope.

Shared name comparison and no-ISBN duplicate rules belong to Task 2. Detailed screen copy/layout refinements belong to Task 6. No automatic publication-monitoring feature was requested. A separate desktop ownership-progression page and bulk generation of planned books are future scope, not blockers to this task.

### Locations, tags, and listings - Task 3 complete

Confirmed rules and fourteen acceptance examples are in [Locations, tags, search, and ordering](locations-tags-search.md). Locations are precreated shelves within bookcases, with scoped name uniqueness, rename/move conflict checks, empty-location retention, and confirmed deletion/unassignment behavior. Tags are shared reusable identities with inline/dedicated management, blocked rename collisions, persistent unused tags, and confirmed deletion safeguards.

Advanced fields, AND across fields, OR within non-tag fields, tag inclusion/exclusion semantics, unassigned choices, and combining simple search with advanced filters are confirmed. Text supports partial case/accent-insensitive matches and equivalent ISBN values. Books sort by title/date added/publication date; unknown publication dates are last. Collections sort by name only and match when one member book satisfies the entire expression; completeness counts remain whole-collection totals. Task 6 owns detailed screen composition and feedback states.

### Accounts, history, and deployment

18. Task 5 is complete: [Accounts](accounts.md) consolidates first-run setup, fixed roles and Admin-only user creation, temporary-password replacement, account protection/deactivation/reactivation, name reservation/reuse, and personal defaults with twelve acceptance examples. There is no pre-login factory reset. Local recovery preserves data; authenticated Admin-settings data reset keeps Admin credentials.
19. Exact account-screen interaction belongs to Task 6; data-reset confirmation/backup expectations belong to Task 7. Authentication/session/storage enforcement belongs to technical agents, not open product questions here.
20. Technical audit logs and Activity are distinct. Define categories and their Activity mapping, additional credential redaction, audit-event retention, timezone, authentication-event/read-only action coverage, and whether any raw technical-log viewer is needed (and for whom). Successful/Failed outcomes, current username display via the user table, and indefinite retention of deactivated user records are confirmed. Define unauthenticated actors, failure payloads, and keyboard/touch equivalents for timestamp hover. Activity is visible to everyone, includes only successful eligible events, and initially excludes before/after values.
21. Which Overview statistics remain useful after removing reading progress/goals? Are there dedicated Activity filters?
22. Define first-run setup access so an internet visitor cannot claim an unconfigured installation. Define HTTPS/TLS, session handling, port setup, and offline requirements before external exposure.
23. Define reset confirmation, session invalidation, backup treatment, and whether network settings must be configured again after application preferences are erased.
24. Confirm initial UI language(s); English/French category labels were discussed, but a translation scope was not approved.

## Lending - Task 4 complete

[Lending](lending.md) contains confirmed business rules and twenty acceptance scenarios; [the design brief](lending-design-brief.md) is reconciled with them. Lending changes only loan state, leaving ownership and collection completeness intact. Starting selections may be removed, keeping at least one book. Initial UI shows active loans with lending date, Lent indicators, and receiver-name/book-title search only. Returned history is retained, preserving former title/ISBN after later book deletion, but a dedicated history UI is future scope.

Activity groups each successful operation into one entry using You collectively for the household and displaying the receiver. Actual actor attribution remains in audit records and timestamp details. Technical records remain per book/loan, linked by operation ID. Task 6 owns screen refinements; implementation mechanics belong to technical agents.

## Design reconciliation

The handoff originated in a directory named Media collection v3, but these documents define v2. Mockup names, counts, example books, and branding are not authoritative product data.

Retain the dark, cover-focused visual direction. Adapt shelf cards to physical Bookcase/Shelf locations. Add the agreed tag editing/filter behavior. Remove ratings, in-progress reading widgets, and reading goals from initial scope. Preserve independent ownership and personal reading state. Keep the add form light; its final optional-field arrangement needs design discussion.

The original handoff did not inspect electron-base-app or select a database/schema. It must not override the chosen foundation or prescribe implementation architecture.
