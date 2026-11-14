# Issue #34 — Statistics page: fun numbers about the library (server and Dashboard view)

Status: **done** (2026-11-15). Decisions by the user on 2026-11-13 (GitHub issue #34), plan approved on 2026-11-15.
Branch `feat/statistics-dashboard`, one pull request. Design: Doop frame "Proposal A · Dashboard" (ready for dev).

Owning docs: [features](../product/features.md#statistics). Feature: `apps/server/src/statistics`; Libris page
`apps/web/src/libris/statistics/`. Follow-ups: #72 (Story view) and #73 (Topics view) add views and no server work.

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
- **Records:** longest book, most expensive book (equal values by title), biggest collection. Each links to its book or
  collection page; a record is hidden when no book has the needed value.
- **Reading** is the signed-in person's own; a Guest sees the whole page without it, prices included.
- **View choice:** a "View" radio group on the title line, the last view remembered in the browser and given in the
  address (`?view=`). It is hidden while the page has a single view (Dashboard); an unknown or missing view falls back
  to Dashboard.
- Computed on the server at each request, nothing stored, one request for the page. Charts are plain SVG and CSS (no
  chart library), coloured from the appearance colour scheme, and every chart also shows its numbers as text. Numbers
  and money follow the interface language.

## API

`GET /api/statistics?category=books|manga|comics` (signed in, any role; no parameter means all categories; an unknown
category gives `400`). Answer `StatisticsDto` (`packages/contracts/src/http.ts`): `ownedBooks`, `singleBooks` (owned
books in no collection), `categories`, `reading` (`null` for a Guest), `pages { total, known }`,
`price { totalCents, known }`, `publishers { byBooks, byPages, without, count }` (each entry carries books and pages),
`authors`, `records { longest, mostExpensive, biggestCollection }` (each nullable),
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
8. `/statistics?view=story` before #72 shows the Dashboard, without a View choice.
9. In French, 4500 books read "4 500" and a total of 3284.50 € reads "3 284,50 €".
