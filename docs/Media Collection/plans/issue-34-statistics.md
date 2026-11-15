# Issues #34, #72, #73 — Statistics page: fun numbers about the library, three views

Status: **done** (2026-11-15). Decisions by the user on 2026-11-13 (GitHub issue #34), plan approved on 2026-11-15.
Branch `feat/statistics-dashboard`, one pull request. Design: Doop frame "Proposal A · Dashboard" (ready for dev).
Story (#72) and Topics (#73) views: done (2026-11-15), branch `feat/statistics-story-topics`, one pull request, web only.
Design: Doop frames "Proposal B · Story" and "Proposal C · Topics" (ready for dev).

Owning docs: [features](../product/features.md#statistics). Feature: `apps/server/src/statistics`; Libris page
`apps/web/src/libris/statistics/`. Story and Topics use the same server answer as the Dashboard.

## Rules

- A page of its own, `/statistics`, with a **Statistics** entry in the Libris menu after Activity. Nothing in Leaf; the
  Overview page is unchanged.
- **Owned books only**, everywhere on the page. Wanted (not owned) books are never counted.
- **Category choice** at the top: *All / Books / Manga / Comics* (*All* by default), kept in the address
  (`/statistics?category=manga`). Every number follows it, except *By category*, which always shows the three
  categories, the chosen one highlighted and the others dimmed. A category without owned books shows the empty state
  with the choice still visible.
- **Collections** count under their own category (one category per collection since #74). A collection is
  **finished** when it carries the Finished mark set on its page. Missing volumes follow the Collections page rule
  (the Collections feature answers the `CollectionTallies` port with its own coverage rule). The biggest collection is
  the one with the most owned books.
- **Rankings** keep the top 10; equal values are ordered by name (A to Z, ignoring case and accents). Publishers rank
  *by books* or *by pages*; books without a publisher are not ranked and their number is shown under the ranking.
  "Only N publishers" shows when there are fewer than 10. A book with several authors counts once for each of them.
  **Authors** rank *by books* or *by pages* too (#84, 2026-11-15): an author's pages are the sum of the known page
  counts of the owned books they wrote, a book with several authors counting in full for each; an author without any
  known page count is left out of the pages ranking. Each order is its own top 10, both follow the category choice,
  and the choice is not kept when leaving the page. The two *Rank by* groups are named "Rank the publishers by" and
  "Rank the authors by" for screen readers. Every view has the authors choice (Dashboard and Story cards, the Topics
  *Authors* panel, whose intro follows it: "The 10 authors with the most books." / "…with the most pages."). The
  Story sentence and the Topics *Top author* card keep the author with the most books.
- **Records:** longest book, most expensive book (equal values by title), biggest collection. Each links to its book or
  collection page; a record is hidden when no book has the needed value.
- **Reading** is the signed-in person's own; a Guest sees the whole page without it, prices included.
- **View choice:** a "View" radio group on the title line (Dashboard / Story / Topics), the last view remembered in
  the browser and given in the address (`?view=`). An unknown or missing view falls back to the remembered one, then
  to Dashboard. Switching view keeps the chosen category and makes no new request.
- **Story view (#72):** one section per fact, a sentence on the left and its chart on the right: your library (split
  bar by category; with a category, "You own N manga." and its share of the library), pages (with the longest book),
  price (with the link to the books without a price and the most expensive book), your reading (not for a Guest),
  publishers and authors (both top 10s, the publishers keep *by books / by pages*), collections (split bar finished /
  unfinished, missing volumes, biggest collection). A section without data is left out. Every sentence has a one and a
  several form, in English and French.
- **Topics view (#73):** seven cards on the left (owned books, pages, total price, read by you — not for a Guest —,
  top publisher, top author, finished collections) work as a single-choice group (arrow keys move, the panel
  follows); the right panel shows the chosen topic in detail. The topic is kept in the address (`?topic=publishers`);
  the first card is chosen at opening and for an unknown topic. The publishers panel shows books and pages side by
  side, without the *by books / by pages* choice. A topic without data shows "—" on its card and an empty panel.
- Computed on the server at each request, nothing stored, one request for the page. Charts are plain SVG and CSS (no
  chart library), coloured from the appearance colour scheme (category colours, decided on 2026-11-15: Books in the
  scheme accent, Manga in yellow `#d5b66f`, Comics in light blue `#7fb6dc`, the blue of the Doop design), and every chart also shows its numbers as text. Numbers
  and money follow the interface language.

## API

`GET /api/statistics?category=books|manga|comics` (signed in, any role; no parameter means all categories; an unknown
category gives `400`). Answer `StatisticsDto` (`packages/contracts/src/http.ts`): `ownedBooks`, `singleBooks` (owned
books in no collection), `categories`, `reading` (`null` for a Guest), `pages { total, known }`,
`price { totalCents, known }`, `publishers { byBooks, byPages, without, count }` (each entry carries books and pages),
`authors { byBooks, byPages }` (each entry carries books and pages), `records { longest, mostExpensive,
biggestCollection }` (each nullable),
`collections { finished, unfinished, missingVolumes }`.

## Acceptance examples

1. 450 owned books, 38 collections, 61 owned books in no collection: the first card reads "Owned books 450 — in 38
   collections and 61 single books". Wanted books change no number.
2. 398 of the 450 books have a price: the price card reads "on 398 of 450 books · 52 without a price"; the link opens the
   Library with *Owned* + *Without price* (and the chosen category, if any).
3. Choose *Manga*: the address becomes `/statistics?category=manga`, every number counts manga only, and *By category*
   still shows the three categories with Manga highlighted.
4. Two publishers with 5 books each: they are ordered by name. With 4 publishers, "Only 4 publishers." shows under the
   ranking; 22 books without a publisher show "22 books have no publisher."
5. *Asterix* written by Goscinny and Uderzo counts one book for each of them in *Top authors*.
6. No owned book has a page count: the *Longest book* record is not shown.
7. A Guest sees the page without *Read by you* and *Your reading*.
8. `/statistics?view=unknown` shows the Dashboard (or the view last chosen on this browser).
9. In French, 4500 books read "4 500" and a total of 3284.50 € reads "3 284,50 €".
10. Story, all categories: "You own 450 books." With *Manga* chosen: "You own 268 manga. That is 60% of your 450
    books.", the other categories dimmed in the bar. One owned book: "You own 1 book.", "It holds 312 pages."
11. Story, no book has a page count: the Pages section is not shown. A Guest has no "Your reading" section.
12. Story: "14 of your 38 collections are finished.", "187 volumes are still missing."; with a single unfinished
    collection: "Your only collection is not finished yet."
13. Topics opens on *Owned books*; clicking *Top author* shows its panel and the address becomes
    `?view=topics&topic=authors`; the Down arrow moves to the next card.
14. Topics, no author on any book: the *Top author* card shows "—" and "Nothing to count yet", and its panel says
    there is nothing to show yet.
15. Choose *Manga*, then Story, then Topics: the address keeps `category=manga` and every view counts manga only.
16. (#84) *Asterix 1* (48 pages) by Goscinny and Uderzo, *Asterix 2* (no page count) by both, *Lucky Luke* (46 pages)
    by Goscinny: by books Goscinny 3, Uderzo 2; by pages Goscinny 94, Uderzo 48.
17. (#84) Top authors opens on *By books*; choosing *By pages* shows the page totals in their own order. In Topics, the
    *Authors* panel does the same and its intro becomes "The 10 authors with the most pages."
