# Task 8 — Overview and Activity

Status: **done** (2026-11-08), ready for review in a pull request, branch `task-08-overview-activity`. Global plan:
[implementation plan](implementation-plan.md).

## Scope

In, for **Libris only** (desktop viewport):

- **Overview** page: counters (Owned books, collections, bookcases / shelves, currently lent), a short list of recently
  added Owned books linking to their details, the viewer's own Read / Not read summary of Owned books (none for Guests).
- **Activity** page built from the technical audit log: only eligible, Successful, shared events; one entry per
  operation (a lending or a return of several books is one entry); household "You" wording; relative time with the
  exact date, time, time zone and acting account on hover and keyboard focus; newest first with Load older.
- EN/FR strings, tests at every level including Guest variants.

Out: Leaf (no Overview or Activity on mobile), category or date filters, before/after values, a raw audit viewer, undo,
history purging, reading goals or in-progress widgets, KI-1 to KI-4 (user: not in this task).

Owning docs: [overview, activity and mobile](../product/overview-activity-mobile.md) (Overview, Shared Activity,
acceptance examples 1–4), [features](../product/features.md) (Overview, Audit logs, Activity),
[lending](../product/lending.md) (Audit and Activity, example 16), [accounts](../product/accounts.md) (current username
after a rename, deactivated accounts), [design guidelines](../design/design-guidelines.md) (hover **and** focus reveal).
Design screens: `nZknF` Overview, `l2xyG` Overview — Guest, `E5DS9p` Activity, `NRYo0` Activity — Empty. Specs win
over drawn screens (for example the drawn Guest Overview shows "Owned · Not read" on recent books: a Guest gets no
reading display).

## Rules (from the owning docs)

Overview
- **Owned books** counts saved Owned edition records: an omnibus is one book; inferred volumes and Not Owned records
  are not counted (example 1).
- **Collections**, **bookcases / shelves** and **currently lent** (active loans) count actual data (example 1).
- **Recently added**: Owned books only, newest first by when the record was added (`books.created_at`), never by an
  ownership change; each links to the book details (example 2).
- **Your reading**: Owners and the Admin see their own Read / Not read counts over Owned books only. Guests see no
  reading summary and no reading status anywhere on the page (example 2).

Activity
- Visible to every role (Guest, Owner, Admin).
- Eligible: Successful records of shared changes to books, authors, collections, locations (bookcases, shelves), tags
  and lending. Never: Failed records, account / security / authentication / settings events, personal reading status
  and private note changes (example 4). The note text is never recorded, so it cannot leak.
- One entry per **operation** (audit operation ID): a lending of 3 books is "You lent 3 books to Sam" while the audit
  keeps one record per book (lending example 16). The receiver name may appear.
- Main sentence always says **You** (the household), whoever acted and whoever views it.
- Relative time, less emphasised than the action. Exact details on hover and keyboard focus: date, time, time-zone
  label, acting account's **current** username (renamed accounts show the new name; deactivated accounts still show
  theirs). Example: "1 November 2026 · 13:42 (CET) · Performed by Alex". Stored UTC, shown in the viewer's time zone and
  language.
- No before/after values, no filters. Newest first, Load older (example 3).

## Decisions (approved 2026-11-08)

1. **Activity is computed by the server.** Which records are eligible and how an operation becomes one entry are
   business rules: a new **`activity` feature** (`apps/server/src/activity/`) with a pure domain service
   `ActivityProjection` that turns one operation's audit records into one entry, an allowlist of eligible categories
   (`ActivityEligibility`, a list rather than exclusions, so a future category stays hidden until chosen), a use case
   `ListActivity`, and a driven port `ActivityRecordReader` implemented by a Kysely adapter over `audit_logs` joined
   with `users` for the current username (read adapters may join across tables; nothing writes). The server returns
   structured entries (a kind and its names/counts), never sentences; Libris writes the EN/FR sentence.
2. **Overview is its own read feature** (`apps/server/src/overview/`): use case `GetOverview` with a driven port
   `LibrarySummaryReader` (Kysely adapter counting books, collections, bookcases, shelves, active loans and the viewer's
   reading statuses, and the five newest Owned books). The Guest rule (no reading summary) is in the use case, not in
   React. One request, `GET /api/overview`, rather than five calls to existing listings.
3. **The main record of an operation** (the one that gives the sentence) is chosen by a fixed category order, because
   audit IDs are UUIDs and records of one operation may share the same millisecond: book changes, then lending, then
   location/tag/collection changes made by a person, then the consequences (`collection.created`, `.updated`,
   `.reopened`, `.removed` caused by a book save, `tag.created` from the book form, `receiver.created`,
   `book.retitled`). Example: renaming a collection gives `collection.updated` + several `book.retitled` → "You renamed
   the collection Naruto to Naruto (new edition)".
4. **Paging by operation**, not by audit row, so a 30-book lending never splits across pages: cursor on the
   operation's time and ID (`?before=<cursor>`), page size in question 3.
5. **Navigation**: Overview becomes the first library entry and `/` opens it (today `/` redirects to `/books`);
   Activity is added after Loans, as in the design. Both pages are open to every role.
6. **Relative time** uses the browser's `Intl.RelativeTimeFormat` (EN/FR built in) through a small `RelativeTime`
   utility next to `DateTimeFormatter`, refreshed every minute while the page is open. The exact details use a new
   `DateTimeFormatter.exact()` giving "1 November 2026 · 13:42 (CET)" (French: "1 novembre 2026 · 13:42 (UTC+1)",
   the browser's own French zone label).
7. **Hover and focus**: the relative time is a focusable `<time dateTime="…">` with a tooltip (`role="tooltip"`,
   linked by `aria-describedby`), shown on hover and focus, closed with Escape. No click/tap reveal.
8. **V1 import** (`npm run dev:import-v1`) writes no audit records, so imported books appear in the Overview (counters,
   recently added by their V1 creation date) but not in Activity. I will not run the import (ask first).

## API contracts

| Endpoint | Who | Result |
| --- | --- | --- |
| `GET /api/overview` | every signed-in role (`401` signed out) | `OverviewDto` |
| `GET /api/activity?before=` | every signed-in role (`401` signed out) | `ActivityPageDto`; `400` invalid cursor |

```ts
interface OverviewDto {
    ownedBooks: number;
    collections: number;
    bookcases: number;
    shelves: number;
    lentBooks: number;
    // Newest first by record-added date, Owned only. `read` is null for a Guest.
    recentlyAdded: { id: string; title: string; authors: string[]; hasCover: boolean; read: boolean | null }[];
    // The viewer's own reading over Owned books; null for a Guest.
    reading: { read: number; notRead: number } | null;
}

interface ActivityPageDto {
    entries: ActivityEntryDto[];
    // Pass as `before` to load older entries; null when there are none.
    older: string | null;
}

interface ActivityEntryDto {
    id: string; // operation ID
    occurredAt: string; // UTC
    actor: string | null; // current username; null when no account was recorded
    event: ActivityEvent; // kind + names/counts, see the wording table
}
```

Audit: one new category, `book.marked-owned`, written by Mark Owned (`MarkBookOwned`, Leaf) instead of `book.updated`
(user's choice, 2026-11-08: the category names the action). Older Mark Owned records keep `book.updated` and read
"You updated…"; audit history is not rewritten. Reading the Overview or Activity is not audited.

## Activity wording (approved, see answer 4)

Names come from the record itself (title, name), so deleted books, tags and shelves still read correctly.

| Event (main record)                          | English                                                                      | French                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `book.created`                               | You added *Dune*                                                             | Vous avez ajouté *Dune*                                                                  |
| `book.updated`                               | You updated *Dune*                                                           | Vous avez modifié *Dune*                                                                 |
| `book.marked-owned`                          | You marked *Dune* as Owned                                                   | Vous avez marqué *Dune* comme possédé                                                    |
| `book.deleted`                               | You deleted *Dune*                                                           | Vous avez supprimé *Dune*                                                                |
| `book.organised`                             | You changed the location or tags of *Dune*                                   | Vous avez modifié l’emplacement ou les étiquettes de *Dune*                              |
| `book.cover-changed`                         | You changed the cover of *Dune*                                              | Vous avez changé la couverture de *Dune*                                                 |
| `author.corrected`                           | You corrected the author *F. Herbert* to *Frank Herbert*                     | Vous avez corrigé l’auteur *F. Herbert* en *Frank Herbert*                               |
| `loan.lent` (1 / n books)                    | You lent *Dune* to Sam · You lent 3 books to Sam                             | Vous avez prêté *Dune* à Sam · Vous avez prêté 3 livres à Sam                            |
| `loan.returned` (1 / n)                      | You recorded the return of *Dune* from Sam · You recorded 2 returns from Sam | Vous avez enregistré le retour de *Dune* par Sam · Vous avez enregistré 2 retours de Sam |
| `collection.updated` (rename)                | You renamed the collection *A* to *B*                                        | Vous avez renommé la collection *A* en *B*                                               |
| `collection.updated` (volume 0)              | You updated the collection *Naruto*                                          | Vous avez modifié la collection *Naruto*                                                 |
| `collection.finished` / `.reopened`          | You marked *Naruto* as finished · You reopened *Naruto*                      | Vous avez marqué *Naruto* comme terminée · Vous avez rouvert *Naruto*                    |
| `collection.deleted`                         | You deleted the collection *Naruto*                                          | Vous avez supprimé la collection *Naruto*                                                |
| `bookcase.created` / `.renamed` / `.deleted` | You created / renamed (*A* to *B*) / deleted the bookcase *Oak*              | Vous avez créé / renommé (*A* en *B*) / supprimé la bibliothèque *Oak*                   |
| `shelf.created` / `.renamed` / `.deleted`    | You created / renamed / deleted the shelf *Shelf 3* in *Oak*                 | Vous avez créé / renommé / supprimé l’étagère *Shelf 3* de *Oak*                         |
| `shelf.moved`                                | You moved *Shelf 3* to *Oak*                                                 | Vous avez déplacé *Shelf 3* vers *Oak*                                                   |
| `tag.created` / `.renamed` / `.deleted`      | You created the *Fantasy* tag · renamed *A* to *B* · deleted *Fantasy*       | Vous avez créé l’étiquette *Fantasy* · renommé *A* en *B* · supprimé *Fantasy*           |

The French words follow the existing catalogue (bibliothèque for bookcase, étagère, étiquette, possédé); I will check
each against `catalog-fr.ts` while writing. Consequences grouped into the same operation (question 2) read as a short
second line, for example "Also created the collection *Naruto* · reopened *Bleach*".

## Screens and states (Libris)

| Route | Screen | States |
| --- | --- | --- |
| `/` | Overview (`nZknF`; Guest `l2xyG`): title, "A shared view of your household library.", Add a book (not for Guests), four counters, Recently added (5 books, "View all books" → My books sorted by added), Your reading (Owner/Admin) | loading, load failure with Retry, empty library ("No books yet" with Add a book for editors) |
| `/activity` | Activity (`E5DS9p`): title, "What changed in your shared household library.", entries, Load older activity | loading, empty (`NRYo0`: "No shared activity yet. Successful changes to the library will appear here."), load failure with Retry, loading older, older failed (Retry beside the button), no more entries (button hidden) |

## Steps (one commit each, approved 2026-11-08)

1. Mark Owned gets its own audit category `book.marked-owned` (`BookAudit.markedOwned`), use-case and API tests
   updated.
2. Activity domain: `ActivityEligibility`, `ActivityProjection` (grouping one operation, main record order, lending
   counts), unit tests.
3. Activity read: `ActivityRecordReader` port and Kysely adapter (eligible Successful records, paging by operation,
   current username), `ListActivity` use case, `GET /api/activity`, contracts, API tests.
4. Overview read: `LibrarySummaryReader` port and Kysely adapter, `GetOverview` use case, `GET /api/overview`,
   contracts, API tests.
5. Libris Overview page and navigation (`/` opens Overview), EN/FR, component tests.
6. Libris Activity page: `RelativeTime`, `DateTimeFormatter.exact`, focusable time with tooltip, wording for every
   event, Load older, EN/FR, component and utility tests.
7. Browser journeys at 1280 × 720 (Owner, Admin, Guest).
8. Architecture review skill, `npm run check` from PowerShell, docs (status, notes for later tasks), push, pull
   request.

## Test list mapped to acceptance examples

Unit (server)
- `ActivityEligibility`: each shared category eligible; account, authentication, settings, appearance, reading-status
  and note categories not (example 4).
- `ActivityProjection`: a lending of three books → one entry with count 3 and the receiver (example 4, lending 16); a
  lending that created the receiver → still one entry; a return of two loans → one entry; a book save that created a
  collection and a tag → one book entry with the consequences; a collection rename with retitled books → one rename
  entry; `book.marked-owned` → "marked Owned"; a deleted book keeps its title; Not Owned creation.
- `ListActivity`: Failed records absent; newest first; page size and `older` cursor; a page never splits an
  operation; current username after a rename; deactivated actor still named; works for a Guest (example 3).
- `GetOverview`: Owned editions counted, omnibus once, Not Owned and inferred volumes not (example 1); recently added
  by record date, Owned only, five at most; reading over Owned only for the viewer, another account's reading not
  counted; Guest gets no reading and no `read` per book (example 2).

API e2e (`activity.controller.e2e-spec.ts`, `overview.controller.e2e-spec.ts`)
- Each endpoint: `200` for Owner, Admin and Guest; `401` signed out; `400` invalid cursor; Activity after real
  operations (lend 3 books → one entry; failed save absent; changed password absent; reading status and note changes
  absent); Load older returns the next page; Overview counters after creating books, collections, shelves and a loan;
  Guest Overview has no reading.

Component (Libris, jsdom)
- Overview: counters from the response; recently added links to `/books/:id`; Owner sees Your reading; Guest sees no
  reading summary, no reading status and no Add a book; loading, failure with Retry, empty library.
- Activity: one sentence per event kind in English (and a few in French); "You" whoever acted; relative time shown;
  exact details on hover and on keyboard focus (with time zone and current username), Escape closes; Load older
  appends and disappears at the end; empty state; failure states.
- `RelativeTime` (unit): just now, minutes, hours, yesterday, days, weeks, months, years, in English and French.
- `DateTimeFormatter.exact` (unit): date · time (zone) in a fixed time zone, English and French.

Browser journeys (Playwright, 1280 × 720, real app)
- Owner: adds a book, lends it with another to a receiver → Activity shows "You lent 2 books to …" and "You added …";
  focusing the time shows the exact details with the Owner's name.
- Admin renames themselves; Activity details show the new name for older entries.
- Owner: Overview counters and recently added follow the actions; the reading summary changes after marking a book
  Read.
- Guest: Overview without reading summary; Activity visible with "You" wording.
- Load older with more than one page of operations (seeded through the API).

## Answers from the user (2026-11-08)

1. **Eligible events: agreed** as proposed (colour scheme excluded).
2. **One entry per operation for everything**, with the consequences on an "Also…" line. An operation with a single
   record (creating a tag, a bookcase, a shelf…) is simply an entry of its own.
3. **Cover folding: agreed**, 2 minutes for now (same account, same book, after its creation or update).
4. **Wording: as in the table**, except a creation reads "You added *Dune*" whatever its ownership (no "as Not
   Owned", at least for now). "You marked *Dune* as Owned" stays for Mark Owned, which
   gets its own audit category `book.marked-owned` (user's choice) rather than `book.updated`. **No links** on entries: plain text,
   as in the design.
5. **Page size: 20 entries**, agreed for now; the user will try it and see.
6. **Relative time: agreed** as proposed.
7. **Overview extras: keep both** (Bookcases & shelves panel; Read / Not read on recent books for Owners/Admin).
   Tried by the user after Task 8: both kept.
8. **`/` opens Overview: agreed.**

## Questions asked (all answered above)

1. **Eligible events.** Proposed list: all book changes except reading status and note (`book.created`, `.updated`, `.marked-owned`,
   `.deleted`, `.organised`, `.cover-changed`, `.retitled`), `author.corrected`, every `collection.*`, every
   `bookcase.*` / `shelf.*`, every `tag.*`, `loan.lent`, `loan.returned`, `receiver.created`. Excluded: `account.*`,
   `setup.*`, `authentication.*`, `server-settings.*`, the Admin's colour scheme (`appearance.*`, an installation
   setting rather than a library change), `book.reading-status-changed`, `book.note-changed`. Agree?
2. **Grouping beyond lending.** One operation can change several things: saving a book can create its collection and a
   new tag; renaming a collection retitles its books. Proposed: **one entry per operation** for everything (not only
   lending): the main sentence plus a short "Also…" line for the consequences (created/reopened/removed a collection,
   created a tag; retitled books are not listed). Alternative: lending grouped only, each consequence its own entry
   (the design draws "You reopened Batman" alone).
3. **Cover after a save.** The form saves the book, then uploads the cover as a separate operation, so adding a book
   with a cover would show "You added Dune" and "You changed the cover of Dune" a second apart. Proposed: a cover
   change made by the same account on the same book within 2 minutes of its creation or update joins that entry (no
   separate line). Alternative: show both entries.
4. **Wording.** The table above (EN/FR). In particular: "You added *Dune* as Not Owned" for a Not Owned record, and a
   distinct "You marked *Dune* as Owned" for Leaf's Mark Owned (otherwise "You updated *Dune*"). Do entries link to
   the book or collection when it still exists? Proposed: **no links** in this task (the design has none).
5. **Page size.** Proposed: **20 entries** (operations) per page, "Load older activity" appends the next 20.
6. **Relative time.** Proposed with the browser's built-in wording, no "Today ·" prefix (the design's "Today · 12
   minutes ago" repeats itself): under 1 minute "just now" / "à l'instant"; then "12 minutes ago" / "il y a 12
   minutes"; "2 hours ago" / "il y a 2 heures"; "yesterday" / "hier"; "3 days ago" / "il y a 3 jours" up to 6 days;
   "last week", "2 weeks ago" / "la semaine dernière", "il y a 2 semaines" up to 4 weeks; months; "last year" /
   "l'année dernière", "2 years ago" / "il y a 2 ans". Hours switch to days by calendar day in the viewer's time zone
   (something done at 23:00 yesterday says "yesterday" at 08:00, not "9 hours ago").
7. **Overview extras drawn in the design.** The design also shows a "Bookcases & shelves" panel (each bookcase with its
   shelf count, "Manage physical locations") and each recent book's reading status ("Owned · Not read"). Proposed: keep
   the panel with actual bookcases (all, name order, scrolling in the panel if long) and show the viewer's own Read /
   Not read on recent books for Owners/Admin only. Alternative: counters, recently added and reading summary only.
8. **Home page.** Proposed: `/` opens Overview (as the design's first navigation entry) instead of My books. Agree?

## Step list

1. [x] Mark Owned writes `book.marked-owned`
2. [x] Activity domain (`ActivityEligibility`, `ActivityProjection`, `ActivityTimeline`); book title added to the
   `book.organised` and `book.cover-changed` audit records
3. [x] `GET /api/activity` (`ActivityRecordReader`, `ListActivity`)
4. [x] `GET /api/overview` (`LibrarySummaryReader`, `GetOverview`)
5. [x] Libris Overview page, `/` opens it
6. [x] Libris Activity page
7. [x] Browser journeys at 1280 × 720
8. [x] Architecture review, `npm run check`, docs

## Notes for later tasks

- **Kept after trying (user, 2026-11-08):** the Overview's Bookcases & shelves panel, the Read / Not read line on
  recent books, the page size of 20 and the two-minute cover folding.
- **Names in audit records (discussed 2026-11-08, not changed):** every deletion record already keeps the name of
  what was deleted (book title, tag, collection, bookcase, shelf), so Activity can always name it. A single shared
  label field on every audit record was considered and left aside.
- **Endpoints added:** `GET /api/activity?before=` (every signed-in role; `before` is the previous page's `older`,
  `<UTC time>_<operation ID>`, `400` otherwise) and `GET /api/overview` (every signed-in role; `reading: null` and
  `read: null` on recent books for a Guest). Neither is audited.
- **Audit changes:** Mark Owned (Leaf) now writes `book.marked-owned` instead of `book.updated`; older records keep
  `book.updated` and read "You updated…". `book.organised` and `book.cover-changed` records now carry the book `title`;
  for older records the Activity reader falls back to the book's current title, then to "a book".
- **New audit categories must be chosen for Activity:** `ActivityEligibility` is an allowlist and
  `ActivityProjection` describes each category; a category missing from either never appears. Task 9 (backup,
  restore, data reset) must not appear unless decided; the data reset deletes the audit history, so Activity starts
  empty after it.
- **Grouping:** one entry per audit operation; the main record is chosen by a fixed category order (UUID audit IDs
  have no insertion order), the other records are the "Also: …" line, `book.retitled` records are never listed.
  Paging counts entries, not records, so a lending is never split. A cover change joins the save of the same book by
  the same account at most two minutes before it (`ActivityTimeline.coverWindowMs`).
- **Overview:** `/` opens Overview (it used to redirect to `/books`); browser tests sign in, wait for the Overview
  heading and click My books where they need it; the desktop tests wait for the Overview heading. The bookcases panel lists every bookcase in name order without its
  own scrolling (an inner scroll area would need keyboard access).
- **Activity layout (redone at the user's request, 2026-11-08)** from the design file `design/media-collection-v3.pen`
  (screen `E5DS9p`): a full-width feed; each entry has a category icon (Lucide stand-ins for the hand-inked set:
  book added, book, lending, return, collection, bookcase/shelf, tag), the action at 16 px and the relative time under
  it; the hover/focus card (340 px) shows the relative time as a small green mono label, then the exact date and
  "Performed by …". The "Also: …" line sits between the action and the time.
- **V1 import:** writes no audit records, so imported books appear in the Overview but not in Activity.
- **Web utilities:** `RelativeTime` (`shared/i18n/relative-time.util.ts`, browser wording, calendar days in the
  viewer's time zone, first letter in capitals: "Yesterday", "Il y a 2 jours", user's request 2026-11-08) and
  `DateTimeFormatter.exact` ("1 November 2026 · 13:42 (CET)"; French uses the browser's zone
  label, for example "UTC+1"). Activity wording lives in `libris/activity/activity-sentence.util.ts`.
- **Checks:** `npm run check` from PowerShell passes (257 files, 2285 tests); the first run found 9 desktop tests still
  waiting for the My books heading after sign-in, fixed.
- **Architecture review (step 8):** no mandatory finding: both features are read-only, their Kysely adapters read
  other features' tables without writing them (allowed for read adapters), the eligibility and grouping rules are
  pure domain services, each use case has its driving port and string token, and each controller has its API tests.
  Fixed during the review: assertions on arranging requests and actions placed after Act in two browser journeys
  (split into their own cases). Optional, not changed: `ActivityProjection.event` is a `switch` over categories (a
  table of describers would read the same today); the Overview's Owned-only counting is a filter in the read adapter,
  stated in the port contract.
