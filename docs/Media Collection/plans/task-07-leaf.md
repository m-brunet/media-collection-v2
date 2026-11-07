# Task 7 — Leaf (mobile)

Status: **plan for review** (2026-11-07), branch `task-07-leaf`. Global plan: [implementation plan](implementation-plan.md).

## Scope

In: the Leaf mobile web application at `/leaf/` (same host and port, shared API) for Owners and the Admin:

- mobile home with two main buttons, Collections and Scan;
- unfinished-collection shopping: list, compact collection view, confirmed **mark Owned** quick add;
- barcode scanning; the scan-gated add form; existing Owned / existing Not Owned branches; Find book with a single
  user-triggered retry; success and failure screens; a phone cover solution (open question below);
- EN/FR strings, tests at every level on a phone viewport (390 × 844), including Guest variants.

Out: mobile lending, a mobile Activity or Overview (Task 8), a manual ISBN entry or direct add route on mobile,
mobile account settings (My account stays on desktop), a phone photo of the cover (rejected in Task 6), shop scraping,
KI-1 (desktop window close with unsaved form, desktop shell only, "later fix pass" chosen by the user).

Owning docs: [overview, activity and mobile](../product/overview-activity-mobile.md) (Mobile sections, acceptance
examples 5–14), [collections](../product/collections.md) (Mobile shopping, acceptance examples 11–12),
[book entry](../product/book-entry.md) (assisted lookup, failure rules, form structure, examples 11–14),
[design guidelines](../design/design-guidelines.md).
Design screens (group "11 · Mobile", 390 px wide): `NVoWI` home, `bJKOJ` unfinished collections, `rfncT` collection
shopping, `jPKsm` no known gaps, `ywvT3` no Owned books, `XCsLH` mark Owned confirmation, `NN4p1` scanner, `tynCA`
camera unavailable, `V7hteo` scanned ISBN / Find book, `FZVyo` already Owned, `C68NX` existing Not Owned
confirmation, `GG05Z` lookup failed (one retry), `N8CbhQ` retry exhausted, `RYlaa` full add form, `NLUVn` success,
`BsyEg` Guest denied, `VAl9N` sign in. Specs win over drawn screens.

Reused from Task 6 (see [task-06-assisted-entry](task-06-assisted-entry.md)): `POST /api/books/lookups` (library
check first, combined sources), `GET /api/books/lookups/covers/:token`, `POST /api/books/lookups/covers`
(cover from an address, home-network guard), `LookupFill` draft filling, the browser-test stand-in
`tests/web/lookup-sources-stub.ts` with `RuntimeOptions.lookupAddresses`.

## Rules (from the owning docs)

Access
- Leaf is for Owners and the Admin. A Guest who signs in sees "Owner or Admin required" and Sign out, never a mobile
  home, also through a deep link (example 5). The data endpoints Leaf adds refuse Guests (`403`).

Shopping (collections.md)
- Lists **unfinished** collections, also those without gaps; Finished ones are hidden.
- Compact view: missing volumes as "Volume N" / "Tome N" entries, covering saved Not Owned and inferred volumes.
- **Last owned** = highest volume covered by any Owned book (omnibus range end included). Manga/Comics show the
  number; Books also show the title. Owned editions are not expanded.
- No gaps: "No known missing volumes" + last owned. No Owned book: missing entries + "No books owned yet", no last owned.
- **Quick add**: only a saved **ordinary** (single-volume) Not Owned book whose volume is covered by exactly that one
  Not Owned record. A confirmation modal; Cancel changes nothing. Inferred volumes are not clickable; omnibus or
  ambiguous Not Owned coverage gives no quick add (no edition picker). An extra Owned edition does not add progress.

Scan and add (overview-activity-mobile.md, book-entry.md)
- The add form opens **only after a successful scan**; no manual ISBN entry, no direct route (example 7).
- Camera unavailable / scan failure: explain, offer **Retry** or **Back to home** only.
- A scan only fills the ISBN; **Find book** starts the lookup (example 8). The library check comes first.
- Existing **Owned** ISBN: "Already owned", Scan another book / Back to home; no creation (example 9).
- Existing **Not Owned** ISBN: confirmation, then the existing record opens for review/update; ownership changes only
  after confirmation; **no external lookup** before or after (example 10).
- New ISBN: lookup result reviewed under the shared field rules, same three sections as desktop (main + cover;
  location and tags; collapsed additional information with Add a personal note).
- Lookup failure: **Retry** once, only when pressed (two attempts in total); a second failure shows an error and
  **Back to home**, no manual completion (example 11). Desktop behaviour unchanged (example 12).
- Leaving or cancelling a changed form asks before discarding; a failed save keeps the draft and allows retry; success
  is shown only after a confirmed save (example 13). Success offers **Scan another book** / **Back to home** (home,
  not Collections) (example 14).

## Decisions proposed (technical, within the specs) — for review

1. **Shopping is computed by the server**, not by React: which volumes are missing, last owned and quick-add
   eligibility are business rules. A pure domain service `CollectionShopping` (collections feature) builds the compact
   view from the collection's coverage and members.
2. **Mark Owned is its own use case** (`MarkBookOwned`, books feature) rather than a full `PUT /api/books/:id` from the
   phone: the server checks eligibility itself (Not Owned, single volume, in a collection, no other Not Owned record on
   that volume) and changes only the ownership. Audited as `book.updated` with before/after (no new category).
3. **Existing Not Owned ISBN**: after the confirmation, the Leaf form opens on the existing book with **Ownership
   preset to Owned** (the confirmation is the person saying "I have it now"); saving sends the usual
   `PUT /api/books/:id`, so all book rules, questions and audit apply. Nothing changes until Save. Find book is not
   offered on this form.
4. **The scan gate lives in the router state**: the add form route receives the scanned ISBN only through in-app
   navigation state set by the scanner; opening `/leaf/add` directly (or reloading it) returns to the home page. The
   backend keeps accepting book creation from any client (desktop manual entry is unchanged); the gate is a Leaf rule.
5. **Lookup failure counting** (to confirm, see open question 3): a lookup counts as failed when the request errors or
   when no book information came back (`found: false`, whether nothing matched or every source was unavailable). A
   partial result (some sources unavailable, some data found) goes to the review. The attempt counter belongs to the
   scanned ISBN and resets on a new scan.
6. **Book form building blocks are shared, not copied.** The draft, save, lookup-fill logic and the field components
   (authors, collection, location, tags, save questions, cover) move from `apps/web/src/libris/books/` to
   `apps/web/src/shared/book-form/` with their tests and styles, behaviour unchanged (own step, Libris tests must pass
   unchanged). Libris and Leaf then each compose their page: Leaf in one column with 48 px touch targets.
7. **Barcode reading behind a web port**: `BarcodeReader` (start on a `<video>`, report an EAN-13 ISBN or a failure)
   supplied through a React context. Production uses the chosen library (open question 1); component tests use a fake
   reader. Only EAN-13 codes starting with 978/979 are accepted, checked with the shared ISBN check digit rule; any
   other barcode keeps scanning with a hint ("This barcode is not an ISBN").
8. **Camera needs a secure page**: phones allow the camera only over HTTPS (or on the computer itself). Leaf opened over
   plain HTTP from another device shows the camera-unavailable screen with an explanation pointing to the HTTPS
   address (Admin › Server settings, Task 0/1 TLS support). Retry / Back to home as required.
9. **Browser tests use Chromium's fake camera** at the boundary: Chromium is launched with
   `--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<file>.y4m`, the video file being a generated
   EAN-13 picture of the test's ISBN (a small test-support writer, no committed binary). The real decoder then reads
   it. Camera refusal: a context without the camera permission. External lookups use `LookupSourcesStub`.

## API contracts

New endpoints (each with its same-directory `*.controller.e2e-spec.ts` suites):

| Endpoint | Who | Result |
| --- | --- | --- |
| `GET /api/collections/shopping?search=` | Owners/Admin (`403` Guest) | Unfinished collections in name order: `{ id, name, missingCount, lastOwned: number \| null, ownedCount }[]` |
| `GET /api/collections/:id/shopping` | Owners/Admin (`403` Guest) | `CollectionShoppingDto`; `404` unknown id; a Finished collection still answers (with `finished: true`) so an open page does not break after another device finishes it |
| `POST /api/books/:id/owned` | Owners/Admin (`403` Guest) | `200` `BookDto`; `404` unknown; `409 quick-add-unavailable` (already Owned, omnibus, not in a collection, ambiguous coverage) |

```ts
interface CollectionShoppingDto {
    id: string;
    name: string;
    finished: boolean;
    ownedCount: number;
    expectedCount: number;
    // Highest volume covered by an Owned book; `title` only when that book is in the Books category.
    lastOwned: { volume: number; title: string | null } | null;
    // In volume order. `quickAdd`: the saved ordinary Not Owned book that may be marked Owned.
    missing: { volume: number; saved: boolean; quickAdd: { bookId: string; title: string } | null }[];
}
```

Reused unchanged: `POST /api/books/lookups` (existing → `{ kind: 'existing', bookId }`, then `GET /api/books/:id` for
its ownership), `GET/POST /api/books/lookups/covers…`, `POST /api/books`, `PUT /api/books/:id`,
`PUT /api/books/:id/cover`, reading/note endpoints, authors/collections/tags/bookcases reads used by the form.

Audit: no new category. Mark Owned → `book.updated` (Successful/Failed, before/after ownership). Creation and
review/update use the existing `book.created` / `book.updated`. Lookups and shopping reads are not audited.

## Screens and states (Leaf routes under `/leaf`)

| Route | Screen | States |
| --- | --- | --- |
| `/` | Home (`NVoWI`): Collections, Scan a book; account name and role, language switch, Sign out | sign in (`VAl9N`), Guest denied (`BsyEg`), password change required (desktop), loading |
| `/collections` | Unfinished collections (`bJKOJ`) with search | loading, empty ("No unfinished collections"), load failure with Retry |
| `/collections/:id` | Collection shopping (`rfncT`, `jPKsm`, `ywvT3`) | last owned / no Owned yet / no known gaps; quick-add entries as buttons, inferred entries as plain text |
| (modal) | Mark Volume N Owned? (`XCsLH`) | Confirm Owned / Cancel; saving; failure keeps the modal with the message |
| `/scan` | Scanner (`NN4p1`) | asking permission, scanning, "not an ISBN" hint, camera unavailable / insecure page (`tynCA`) with Retry / Back to home |
| `/scan/found` | Scanned ISBN (`V7hteo`): Find book, Scan again | checking library, looking up; already Owned (`FZVyo`); existing Not Owned confirmation (`C68NX`); lookup failed with Retry (`GG05Z`); retry exhausted (`N8CbhQ`) |
| `/add` | Review book (`RYlaa`): three sections, cover, Save book / Cancel | lookup review choices and conflicts (as desktop), save questions, save failure kept, discard confirmation |
| `/books/:id/review` | Existing Not Owned book, ownership preset Owned | same form, no Find book |
| `/saved` | Book added (`NLUVn`) / Book updated | Scan another book / Back to home |

The phone cover area follows open question 2.

## Steps (one commit each, after approval)

1. Shared book form: move the form building blocks to `shared/book-form/` (no behaviour change; all Libris tests green).
2. Collections shopping: `CollectionShopping` domain service + unit tests (examples 11–12 of collections.md and the
   rules above), use cases `ListShoppingCollections`, `GetCollectionShopping`, endpoints, API tests.
3. Mark Owned: `MarkBookOwned` use case + unit tests, endpoint, API tests (roles, eligibility refusals, audit).
4. Leaf shell and shopping UI: routes, home, collections list, shopping view, quick add modal; EN/FR; component tests.
5. Scanner: chosen library, `BarcodeReader` port and adapter, scanner screens, CSP change if needed; component tests.
6. Scan-to-save flow: scanned ISBN, library check branches, Find book with one retry, the phone form (new and existing
   Not Owned), cover solution, success/failure screens; component tests.
7. Browser journeys on the phone viewport (fake camera, lookup stub, Guest variants).
8. Architecture review skill, `npm run check`, docs (status, notes for later tasks, credits for the barcode library).

## Test list mapped to acceptance examples

Unit (server)
- `CollectionShopping`: gaps listed in order incl. saved Not Owned and inferred; last owned from an omnibus range end;
  Books last owned has a title, Manga/Comics none; no gaps; no Owned book (no last owned); extra Owned edition counts
  once; quick add offered for an ordinary Not Owned volume; not offered for an inferred volume, a Not Owned omnibus, or
  two Not Owned records on one volume (collections examples 11, 12).
- `ListShoppingCollections`: Finished hidden, unfinished without gaps kept (example 11); Guest refused.
- `GetCollectionShopping`: unknown id; Guest refused.
- `MarkBookOwned`: marks an eligible book Owned; refuses already Owned, omnibus, standalone, ambiguous; Guest refused;
  audit before/after; failed attempt audited (example 12).

API e2e: each new endpoint — success, `401` signed out, `403` Guest, `404` unknown, validation (`400` bad id),
`409 quick-add-unavailable`, audit record of mark Owned.

Component (Leaf, jsdom)
- Guest sees the denial, not the home (example 5); home has Collections and Scan (example 6).
- Shopping list hides Finished (server-filtered) and shows counts/last owned; shopping view states; inferred entry not
  clickable; quick add asks first, Cancel changes nothing, Confirm calls the endpoint (example 12).
- `/add` opened without a scan returns home (example 7); camera unavailable offers Retry / Back to home only (7).
- Scan fills the ISBN; no request until Find book (8). Already Owned screen without creation (9). Existing Not Owned:
  confirmation, then the form with Ownership Owned and no lookup request (10). Failure → Retry → second failure →
  Back to home only, no manual form (11). Discard confirmation and kept draft on save failure (13). Success screen
  choices (14). Non-ISBN barcode hint.

Browser journeys (Playwright, 390 × 844, real app, fake camera, lookup stub)
- Owner: home → Collections → collection → mark a Not Owned volume Owned (confirmed), list updated.
- Owner: scan → Find book → review → save → Book added → Scan another book.
- Existing Owned ISBN → Already owned; existing Not Owned → confirm → review → save Owned (stub records no request).
- Both sources failing → Retry → failing again → Back to home.
- Camera refused → explanation, Retry / Back to home.
- Guest signs in → denied; Guest deep link `/leaf/collections` → denied.
- No horizontal scrolling on each screen.

Desktop regression: existing Libris component tests and browser journeys pass unchanged after step 1.

## Answers from the user (2026-11-07)

1. **Barcode library: `barcode-detector`** (MIT; the phone's own detector when available, otherwise the bundled
   `zxing-wasm` reader, MIT, from ZXing-C++, Apache-2.0). The WebAssembly file is bundled with Leaf and served by the
   app, never from a CDN; the Content Security Policy gains `'wasm-unsafe-eval'` in `script-src`. Rejected:
   `@zxing/browser` (maintenance mode, weaker on difficult pictures), `quagga2` (more tuning).
2. **Phone cover: as proposed**, in this order on the form: Find book covers as choices; **Search this cover on the
   web** (new tab, the form stays open); a prominent **image address** field with a **Paste** button, then **Use this
   picture** (server download with the home-network guard and padding removal); **Choose from photos** (saved picture,
   no camera `capture` hint). **Android share target deferred**: it needs an installed app (manifest, service worker)
   and a trusted HTTPS certificate.
3. **Not found counts as a failed lookup** (decision 5): Retry once, then Back to home; the messages still say whether
   nothing was found or the sources were unavailable. A partial result goes to the review.
4. **Branch `task-07-leaf` with a pull request** at the end, one commit per step.

## Open question (plan review)

5. **Existing Not Owned ISBN form** (decision 3): Ownership preset to Owned after the confirmation. Agree?

## Notes for later tasks

(Filled in during implementation.)
