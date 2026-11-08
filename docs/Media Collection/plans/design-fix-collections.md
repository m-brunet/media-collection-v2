# Design fix: Collections pages (Libris)

Status: done (2026-11-06), committed on `master`. Inserted before Task 6 at the user's request.

Scope: only the Collections pages go back to the design. The shell/sidebar stays as it is; other sections are
compared later, after the user reviews their designs.

## Why

The Libris Collections list and collection details pages work (Task 3) but do not follow the design. Reference:
the Doop canvas `shiKEeCX2V` (formerly the Pen file `design/media-collection-v3.pen`), frame **03 · Collections** (desktop: list, details unfinished, details Finished,
empty). The exported artifact screens yUD6M, C68ok, zq1kt and yJXFw show the same layouts. As always, product documents
win over drawn screens, and names, counts, covers and copy in the design are placeholders.

Owning documents: [collections](../product/collections.md), [design-guidelines](../design/design-guidelines.md),
[task-03-collections](task-03-collections.md).

## Differences found

Compared by rendering the current pages with design-like data next to the design at 1440 × 960.

### Collections list

1. **Layout.** Design: a two-column grid of cards (24 px column gap, 20 px row gap). Now: a single-column list of thin
   bordered rows.
2. **Card.** Design: borderless surface card (`#1D2022`, radius 7, padding 24); top line = name (Space Grotesk 23)
   with `Open →` in accent; below, up to two cover previews (67 × 100, whole cover, not cropped) beside
   `4 / 12 volumes Owned` (16 px) and the status line (12 px, muted; `Finished` in accent). Now: name, count, status
   and Open spread across one row in four columns; no covers; Finished not accented.
3. **Cover previews need data.** `CollectionSummaryDto` carries no books, so the list cannot show covers today. This
   needs a small contract/backend change (see questions).

### Collection details

4. **Summary block.** Design: no panel; the eyebrow, `Expected coverage: volumes 1–12` and the volume-0/highest line
   sit on the page background, with `Edit collection` and `Mark Finished` on the right of the same block. Now: all in a
   panel with the buttons below the text.
5. **Finished eligibility callout.** Design: a full-width callout under the summary: warning tone (dark olive
   background, amber text) "Own every expected volume before marking this collection Finished." while volumes are
   missing; accent-background callout "Finished collections remain on desktop and are hidden from mobile shopping."
   when Finished. Now: a plain muted sentence inside the panel.
6. **Volumes.** Design: no surrounding "VOLUMES" panel; each volume is its own card (`#1D2022`, radius 7, padding 16,
   12 px apart); the label (16 px) on the left and the state (12 px, muted) starting at the middle column. Now: nested
   inside a panel, lighter control-coloured rows, state right-aligned and owned states in accent colour.
7. **Expanded editions.** Design: the editions of a volume sit side by side, each with its cover (50 × 72), title
   (14 px), a detail line (11 px muted) and `View this book →` in accent, no underline. Now: stacked full-width rows,
   no cover, detail pushed to the right, underlined link. `CollectionMemberDto` has `hasCover` but no version for the
   cover URL (`BookFormat.cover(id, updatedAt)`), so it needs `updatedAt` too.
8. **Small copy/format points.** Breadcrumb separator `Collections / Batman · 4 of 12…` (now `Collections · …`);
   `volumes 1–12` lower-case inside the coverage sentence (now `Volumes 1–12`).

### Empty list

9. The drawn empty state (480 px left-aligned column, full-width `Add a book`) differs from the shared `EmptyState`;
   kept as built by the user's decision.

Not differences: the toolbar (search, Advanced filters, sort) and the page header already match; the native sort
select stays (accessible and matches in style). The whole card stays one link (larger target, same as now).

## Approach

Web-only except one additive contract change; no domain or persistence rule changes.

1. **Contract and backend (previews and cover versions).**
   - `CollectionMemberDto` gains `publisher` and `updatedAt` (the book's, for the cover URL).
   - `CollectionSummaryDto` gains `previews: CollectionPreviewDto[]` (`id`, `title`, `updatedAt`): at most two
     books with a cover, by decision 1. Computed by the collections read side from data it already
     loads for coverage; API e2e tests for list and details; contract tests updated.
2. **List page.** `CollectionCard` replaces `CollectionRow`: two-column grid, card layout above, covers through the
   existing `BookCover` (`small` size or a new `preview` size at 67 × 100 with the missing-cover fallback). Spec
   updated: card content, Finished accent class, covers' alternative text, link name.
3. **Details page.** Summary block without panel and with actions on the right; `FinishedCallout` (warning / accent
   tones, still referenced by `aria-describedby` from the disabled button); volume cards; editions side by side with
   covers; link style; breadcrumb and casing copy (EN and FR catalogues). Spec updated.
4. **Responsive check.** At 1280 px the list keeps two columns and the details' actions wrap under the summary rather
   than clipping. Browser journey screenshots/assertions for list and details at 1280 and 1440.
5. **Review and docs.** Architecture review, `npm run check`, note in `task-03-collections.md`, status row in the
   implementation plan.

New reusable pieces go to `shared/ui` only if a second page needs them (callout tone may already exist in `Notice`;
reuse it if its look can match).

## Decisions (2026-11-06)

1. **Card covers:** the two lowest-numbered owned books that have a cover, then other members with a cover, in coverage
   order; no previews (and no fallback tiles) when no member has a cover.
2. **Finished callout:** accent background with accent text (the amber text in the drawn Finished frame is a slip).
3. **Disabled finish button:** label stays `Mark Finished`, disabled; the warning callout explains why (linked by
   `aria-describedby`). No "· unavailable" suffix.
4. **Edition detail line:** `Publisher · ISBN …`; without a publisher, only the ISBN; without either, the existing "No
   ISBN" text. An omnibus prefixes `Omnibus · Covers 1–3 · `. A Not Owned book keeps its `Not Owned · ` prefix
   (status is never conveyed by colour alone).
5. **Sidebar/shell:** unchanged.
6. **Other sections:** out of scope; compared later after the user reviews those designs.

## Steps

1. [x] Contract and backend: member `publisher`/`updatedAt`, summary `previews`
2. [x] List page cards
3. [x] Details page: summary, callouts, volume cards, editions with covers, copy
4. [x] 1280/1440 browser check
5. [x] Review, check, docs

## Architecture review (2026-11-06)

No mandatory findings. The backend change is additive read-model data: the collections member store reads the book's
publisher and change time with the columns it already joined, and `CollectionViewer` chooses the previews in a private
method. The browser pages reuse `BookCover`/`BookFormat` from `libris/books` (browser-only code) and keep wording in
`CollectionFormat`. One review fix: the 1280 px browser check was split into one case per page.

## Notes for later tasks

- Collection cards take their link name from `aria-label` (name, counts, status): spans inside a link otherwise run
  together for screen readers ("BatmanOpen"), and the covers are decorative there.
- The volume heading and card identity use two equal columns, as drawn: the state starts mid-card, not at the right.
- Other sections were not compared; the user reviews their designs first.
- Empty list: kept as built (shared `EmptyState`), by the user's decision (2026-11-06); only the list and details
  pages needed rework.
- Some covers look smaller with white edges: 177 of 437 development covers are padded shop squares. Decided
  (2026-11-06): remove the padding when covers are saved, as Task 6 step 1; see
  [book entry · Cover padding](../product/book-entry.md#cover-padding).
