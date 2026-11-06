# Task 6 — Assisted entry (desktop)

Status: approved (2026-11-06), in progress on branch `task-06-assisted-entry`, reviewed through a pull request
(the user's request for this task; earlier tasks were committed on `master`).

## Scope

In: cover padding removal (step 1, decided); choosing and ordering the lookup sources from a measured trial; **Find
book** on the Libris Add a book form: library check first, a lookup combining several sources, a separate cover
lookup, filling the draft with replacement confirmation, no-result and unavailable feedback with manual completion.

Out: Leaf scanning and the mobile lookup flow (Task 7, which reuses this API); refreshing an existing book from the
edit form (a possible later nice-to-have); the credits/licences page (its own task; this task records what it must
list); scraping shop websites (last resort only, after an explicit human decision).

Owning docs: [book entry](../product/book-entry.md) (assisted lookup, lookup sources, failure and incomplete results,
cover padding, acceptance examples 9 and 11–20), [features](../product/features.md) (Cover field, ISBN lookup),
[design guidelines](../design/design-guidelines.md). Design screens: `tr7ll` (Add a book), `VMQcQ` (choose metadata and
cover), `YSboR` (no result, manual completion), `f0mDwI` (service unavailable), `OGDgW` (confirm draft replacement).

## Decisions (2026-11-06)

- Any source with a rate limit may be used, provided the app enforces that limit itself (see Lookup sources).
- Results must suit French users, who may also own English books: a **summary is kept only in the edition's
  language**; otherwise the summary stays empty.
- One lookup **combines several sources**: missing fields are completed from the next sources; where sources disagree,
  the **preferred source's value is the first choice** and the others are offered as alternatives.
- Covers have **their own list of sources**. The same picture from several sources is shown once, **at its best
  resolution**.
- Scraping shop websites only as a last resort, after a careful human decision; never by default.
- `sharp` approved for image decoding/encoding. Find book on the edit form left for later.
- Draft conflicts are confirmed in **one dialog** listing every conflicting field (each Keep mine / Use lookup).
- Implementation: a **chain of responsibility** for the sources (below), if it stays suitable during implementation.

## Step 1 — Cover padding removal (own commit)

Rule: [book entry · Cover padding](../product/book-entry.md#cover-padding). Trial on the development covers: 174/177
padded squares and 6 padded portraits trimmed, 3 safely left alone, none cut into.

- **Domain (pure):** `CoverPadding`, a domain service measuring the padding of decoded pixels (width, height, RGBA
  bytes) and returning the crop box, or none when the rule refuses. All thresholds live here and are unit-tested
  with small synthetic pixel grids: shop square, padded portrait, white artwork at one edge (Guild Wars case), white on
  both axes (Final Fantasy IX case), grey padding, no padding, JPEG-noise tolerance.
- **Driven port** `CoverTrimmer` (books feature): `trim(cover: CoverImage): Promise<CoverImage>`. The `sharp` adapter
  decodes to pixels, asks `CoverPadding`, and when there is a box crops and re-encodes in the same format at high
  quality (JPEG/WebP quality 90, PNG lossless); otherwise it returns the input unchanged, byte for byte.
- **Wiring:** `ReplaceCover` and `ImportBook` trim before `CoverStorage.store`. A decoding failure of a file that
  already passed `CoverImage` keeps the original (logged), never loses the cover.
- **Tests:** unit (rule, both use cases with a double), adapter test with real JPEG/PNG/WebP fixtures, API test on
  `PUT /api/books/:id/cover` (stored image is narrower), V1 import check. Packaging: `npm run test:packaged` confirms
  `sharp` loads in the packaged Electron app (native module, like `better-sqlite3`).
- **Afterwards:** re-run `npm run dev:import-v1` to clean the development covers (this replaces the development library,
  as that command always does).

## Step 2 — Source trial and order (decision gate)

Candidates, terms checked 2026-11-06:

| Source | Gives | Terms |
| --- | --- | --- |
| BnF catalogue (SRU) | French bibliographic data, no covers, no summaries in general | Licence Ouverte: free reuse, source credited |
| Google Books API | Metadata, summaries with a language, small covers | Free at low volume. Google attribution required next to displayed results; content must not be altered; storing cover copies unclear |
| Open Library (Books API + Covers) | Metadata, covers | Free. ISBN cover lookups limited to 100 per IP per 5 minutes; covers for display, not bulk download; a link back appreciated |

A development-only trial command reads the ISBNs of the development library (437 books, from V1) and queries each
source **slowly, below every published limit** (one request at a time with a pause; Open Library's Books API rather
than its Covers endpoint). Per source it reports: found; title, authors, publisher, date, pages present; summary
present and its language versus the edition's; cover present and its size. Nothing is stored. I bring you the numbers
with a proposed **preference order per field** and **cover source list**; adapters are written only for the sources
you approve. If cover coverage stays poor, we discuss further sources then (shops only as a last resort).

## Lookup sources and combining

**Chain of responsibility.** Each approved source is one link (`LookupLink`), ordered by preference. A link receives
the lookup in progress, **adds** what its source knows and **passes it on**; it never stops the chain, so later links
can still offer alternatives. A link that is rate-limited, fails, times out or finds nothing passes the lookup on
unchanged and records why. The source requests start together at the beginning of the lookup, so a lookup lasts as
long as its slowest source, not their sum; the chain then combines the answers in preference order. Adding or
reordering a source changes the chain's composition (`books.module.ts`), not the combining code. Covers use a
separate chain of cover links with their own order.

**Combining (pure, unit-tested).** For each field (title, authors, publisher, publication date reduced to month/year,
page count, summary) the first link offering a value supplies the first choice; different values from later links
become alternatives, each with its source. Values that differ only by case, accents, punctuation or author name order
(`Murakami, Haruki` / `Haruki Murakami`, life dates removed) count as the same value. A summary is kept only when its
language is the edition's language (or the source does not distinguish and the edition language matches).
Category, price, ownership and collection are never filled from a lookup.

**Covers.** Every cover link offers its candidates; candidates below a minimum size (about 300 px tall) are dropped;
the same picture offered several times (compared on a small downscaled fingerprint) is kept once, at the best
resolution. The preferred source's cover is the first choice.

**Rate limits and courtesy.** Each source declares its limit; the app keeps a per-source budget below it, skips a source
whose budget is spent (the lookup continues with the others and says so), and honours "too many requests" / retry-after
answers by pausing that source until the given time. Requests identify the application generically (name and project
address, never a person's email).

## Steps 3–7 — Lookup implementation

**Backend (books feature).**
- Driving `LookUpBook.execute(actor, isbn)`: Owners/Admin only; validates and normalises the ISBN (`Isbn`, ISBN-10 →
  ISBN-13); checks the library first and returns `{ existing: bookId }` without contacting any source (example 11).
  Otherwise runs the metadata chain and the cover chain and returns, per field, the first choice and alternatives
  with sources; the cover candidates; and `unavailable` (sources skipped or failed, with the reason). This keeps "no
  result" distinct from "service unavailable" (example 13).
- Driven ports: `LookupLink` (metadata) and `CoverLink` (covers), one adapter per approved source under
  `infrastructure/adapters/driven/third-party/`; `SourceBudget` for the rate limits; `Clock`.
- Covers never reach the browser by their external address (the Content Security Policy only allows same-origin images,
  and the server must not fetch arbitrary addresses). Each candidate gets a random token kept in memory for 30 minutes;
  `GET /api/books/lookups/covers/:token` fetches it once from its source, checks it with `CoverImage` and serves it.
  Choosing it in the form uploads it through the existing cover upload when the book is saved, which trims it
  (step 1). Nothing is stored before saving.
- Endpoint `POST /api/books/lookups` `{ isbn }`, Zod-validated; `403` for Guests; `400` for an invalid ISBN. No audit
  record (a lookup changes no shared data; saving is audited as today). Source failures are logged technically,
  without personal data.
- Tests: unit (combining: gap filling, first choice from the preferred source, alternatives, equivalent values,
  summary language, date reduction; chain: skipped/failed links pass on; budgets and retry-after; cover de-duplication
  keeping the best resolution; use case: existing ISBN, Guest refused), adapter tests against recorded responses (no
  network in tests), API e2e with fake links (every endpoint, roles, validation, unknown/expired cover token).

**Libris (Add a book).**
- `Find book` beside the ISBN (`tr7ll`); disabled while the ISBN is empty or "This book has no ISBN" is checked.
  Typing never triggers a lookup.
- Existing ISBN: open that book's details (no duplicate, no ownership change).
- Result: the review (`VMQcQ` style) shows the combined values with their source; fields where sources disagree offer
  the alternatives, the preferred source's value selected first; covers are shown as choices, the first selected.
  Nothing reaches the form until **Use these values**.
- Draft conflicts: fields already filled differently are listed in one **Replace your entered values?** dialog
  (`OGDgW` pattern), one row per field with Keep mine / Use lookup; keeping is the default.
- No result (`YSboR`) and unavailable (`f0mDwI`): a message under the page title, the ISBN kept, `Retry lookup`,
  manual completion always possible; the message says which case it is and which sources were unavailable.
- Attribution: the review names each value's source (and shows Google's mark if Google Books is approved).
- Tests: component tests for each state, EN/FR strings; browser journeys (1280 and 1440) against a local stub
  standing in for the sources (adapters take their base address from configuration), including unavailable and
  rate-limited sources.

**Step list**
1. [x] Cover padding removal (own commit); development covers still to clean (`npm run dev:import-v1` refused
   while the development app was open)
2. [ ] Source trial, report, user choice of sources and order
3. [ ] Domain/application: combining, chains, budgets, `LookUpBook`, unit tests
4. [ ] Approved source adapters, cover tokens, endpoints, API tests
5. [ ] Libris Find book: review, conflicts, covers, states, component tests
6. [ ] Browser journeys with stubbed sources
7. [ ] Architecture review, `npm run check`, docs (credits list for the future credits page)

## Notes from step 1

- `sharp` 0.35 loads at backend start; its native files are unpacked from the app archive (`asarUnpack`), checked in
  the packaged app (decode, crop, WebP encode) and by `npm run test:packaged`.
- The packaged smoke test's final cleanup now retries briefly: on Windows the backend process, started in the
  temporary data folder, can still hold it for a moment after the window closed (seen once `sharp` was loaded; no
  process remains afterwards).
- The trimmer is registered inside `BooksModule` (no configuration needed), so app, API tests and development
  commands share it.

