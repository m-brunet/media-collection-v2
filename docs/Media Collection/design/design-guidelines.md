# Design guidelines

Status: accepted direction, 2026-11-03. This document replaces the former versioned `design/README.md` and the retired `handoff-lending-final` export.

## Design reference and authority

The design reference is the Doop canvas **`shiKEeCX2V`** (doop.design). It is not versioned in this repository. It replaces the former Pen file `media-collection-v3.pen`: frames and groups that older documents name in the Pen file are found by the same names on the canvas. Pages exported from the canvas (for example `Page 40 · Overview.html`) are kept in the Git-ignored `design/` folder at the repository root. If the canvas or the export needed for a task is missing, ask the user rather than inferring the design.

The same folder keeps the earlier interactive artifact exported from the Pen file: open `design/artifact/index.html` to browse its screens (desktop and mobile, including empty, loading, error, and confirmation states), and `libris-design-artifact.zip` is a packaged copy. Task plans cite its screen IDs and its icon library (below); when it differs from the canvas, the canvas wins. Earlier handoffs and icon-style proposals are retired; do not implement their concepts (virtual shelves, ratings, reading progress, goals) or text.

Product documents in `docs/Media Collection/` always take precedence. When a drawn screen conflicts with them, follow the documents unless the conflict suggests a real documentation error; in that case raise it rather than silently choosing. The artifact is a guide for style, colours, positioning, ratios, and proportions. It is neither pixel-perfect nor an exhaustive screen inventory: pages, dialogs, and states that are not drawn are built in the same style from the closest existing pattern. Images, counts, names, and copy in the artifact are representative placeholders, not specified data or final wording. Mockup cover images must never be shipped, seeded, or packaged.

## Names

- The overall project and product is **Media Collection**. Use it for the installer, packaged Electron application, GitHub repository/releases, and host-local maintenance window.
- The desktop web interface (Electron and desktop browser) is **Libris**. Wherever the interface shows its name, such as the top-left of the sidebar or the sign-in page, display `Libris` with `by Media Collection` underneath in a smaller but still readable size.
- The mobile web interface is **Leaf**.

Older documents that say "Media Collection v2" or "MC" refer to this product.

## Desktop and mobile sites

Libris and Leaf are separate web applications, not one responsive interface. Both are served by the same installation on the same host and port, sharing the same HTTP API:

- Libris at `/`.
- Leaf at `/leaf/`.

Using one port keeps internet access to a single router forwarding rule. Leaf access remains Owner/Admin-only and must be enforced by the server, not only by its interface; a Guest reaching `/leaf/` sees the access-denied page.

## Visual direction

Quiet dark surfaces, book covers in portrait proportions without cropping (shop padding around a cover is removed when it is saved; see [book entry](../product/book-entry.md#cover-padding)), and a green accent. Inter for body text, Space Grotesk for headings and the product name, IBM Plex Mono for small uppercase section labels. Fonts are bundled with the application, never loaded from the internet, because desktop use must work offline.

The artifact's CSS is generated per screen and is not reused. Implementation defines a small set of named design values (colours, type scale, spacing, radii, borders) and reusable components (shell/sidebar, buttons, inputs, selects, dialogs, book cover with missing-cover fallback, status labels, empty/loading/error states), so that new pages inherit the style automatically.

## Colour schemes

The Admin chooses the installation's colour scheme in Administration → Appearance; it applies to every account, in Libris and Leaf, including the sign-in page. It is a saved application preference: included in backups, and an Admin data reset returns it to the default. Libris and Leaf are dark only.

There are eight schemes (KI-6, 2026-11-09): Spring green, and seven schemes from the design (Doop canvas `shiKEeCX2V`, groups 13 "Appearance collection — 10 non-green themes", 14 "Dark Purple" and 15 "Red study"). Mint, Emerald and Forest are no longer offered; an installation that had chosen one moved to Spring green. Each scheme is a full palette: backgrounds, borders, text and accent all change. The source of truth is `apps/web/src/shared/ui/tokens.css`. Two schemes are shown under their own names rather than the design's (decided 2026-11-09, after Desna, the goddess of dreams and travel of the Pathfinder universe, whose symbol is the butterfly): Velvet violet (`velvet-violet`) is **Desna’s reveries** (FR **Rêveries de Desna**), Slate × Orchid (`slate-orchid`) is **The Butterfly’s Way** (FR **La Voie du papillon**).

| Scheme | Background | Panel | Control | Border | Text | Secondary text | Accent | Accent background | Accent text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Spring green (default) | #1D1F20 | #1D2022 | #303336 | #3C4042 | #F2F5F2 | #A9B5AC | #79D670 | #2B3E29 | #BDEBB8 |
| Midnight blue | #191F2C | #151B26 | #252E3D | #3D4F6B | #F0F5FF | #ABBBD2 | #8BB8FF | #10213B | #C6DCFF |
| Desna’s reveries | #201C28 | #191620 | #2E2739 | #514361 | #F7F0FF | #BFB0CF | #C4A3FF | #27133F | #E2D2FF |
| Ember | #27201D | #1F1916 | #372E28 | #604A3D | #FFF3E9 | #CDB7A7 | #FFAD79 | #361B0C | #FFD7BD |
| Rose noir | #261E24 | #1F191F | #362C33 | #5C4354 | #FFF0F7 | #CEAFBF | #F3A4C4 | #371425 | #F9D2E2 |
| Graphite gold | #242424 | #1D1D1D | #323232 | #505050 | #F7F5EE | #BCBAB2 | #E4C56B | #2C240C | #F2E2B6 |
| The Butterfly’s Way | #252B32 | #20262D | #343D47 | #4D5C6A | #F3F6FA | #B6C1CD | #D7ACFF | #301B40 | #EBD6FF |
| Warm charcoal × Soft scarlet | #272426 | #211F20 | #343032 | #51484C | #FFF2F1 | #D0B2B7 | #FF9994 | #3A1719 | #FFCDCA |

The design does not draw every role. The surface, control hover, strong border, muted text, accent text and text on the accent are derived from each scheme with the ratios that give Spring green's values, and `tests/web/color-scheme-contrast.spec.ts` checks every scheme against WCAG AA (text 4.5:1 on every surface, accent 3:1). Status colours (danger, warning) are shared. The local recovery window, which runs without the server, always uses Spring green.

## Window size

The minimum supported desktop size is 1280 x 720. The Electron window cannot be resized below it, and the desktop-browser layout is designed to remain fully usable at that size. Screens are drawn at 1440 px wide; between 1280 and 1440 px, secondary panels such as the selected-book panel narrow or move rather than clipping content. Leaf is designed for phone widths (reference 390 px).

## Icons

**Libris icon.** The official Libris icon is the library brand mark of set 02 "Hand-inked editorial sketches" (Streamline Freehand, CC BY 4.0), always drawn in the Spring green accent `#79d670`: it is the desktop window and taskbar icon, the mark next to the "Libris" title and the favicon of the browser version, and it does not change with the colour scheme or the chosen icon set. Source: `apps/web/public/libris.svg`; desktop icon files and their credits in `apps/desktop/assets/icons`. **Leaf icon (decided 2026-11-09):** the Turning leaf is Leaf's application icon (the icon a phone shows when Leaf is added to the home screen) and its favicon, and the mark next to the "Leaf" title. Like the Libris icon, it is one fixed version: the Turning leaf of set 02 "Hand-inked editorial sketches" (`02-hand-inked-editorial/turning-leaf.svg`), always drawn in the Spring green accent `#79d670`; it does not change with the colour scheme or the chosen icon set.

Lucide is the default icon set. The Admin can choose the installation's icon set in application settings; the choice applies to every account and to both Libris and Leaf. It is a saved application preference: it is included in backups and returns to Lucide after an Admin data reset.

Available sets come from the artifact's icon library (`design/artifact/icons/`):

| Set                              | Source of the artwork | Licence   |
| -------------------------------- | --------------------- | --------- |
| 00 Current icons                 | Lucide                | ISC       |
| 01 Solid silhouettes             | game-icons.net        | CC BY 3.0 |
| 02 Hand-inked editorial sketches | Streamline Freehand   | CC BY 4.0 |
| 03 Architectural wireframes      | Streamline Cyber      | CC BY 4.0 |
| 04 Single-ink risograph prints   | Streamline Ultimate   | CC BY 4.0 |
| 05 Quiet editorial monoline      | Iconoir               | MIT       |

Every icon is the work of the authors of its pack; sets 01-05 were selected from these packs and recoloured or lightly adapted for Libris. Full credits, licence links, and the changes made are in `design/artifact/icons/CREDITS.md`, with per-icon provenance in `SOURCES-AND-LICENSES.json`. Each alternative set covers 25 named purposes (brand, navigation, lending, return, scan, states such as loading/error/empty/missing cover, the Turning leaf, and similar). Small utility icons that those sets do not provide, such as close, chevrons, check, add, edit, and delete, stay Lucide in every set. The sets follow the colour scheme the way Lucide does (decided 2026-11-09): they are drawn in the text colour, so grey in a normal link and the accent in a selected one; a second tone, where a drawing has one, is the same colour at 60 % opacity (`tools/import-icon-sets.mjs` copies them into `apps/web/public/icon-sets`).

**Turning leaf.** The Turning leaf icon of every set (`turning-leaf.svg`, Doop canvas `shiKEeCX2V`) is not taken from a pack: it was generated with GPT Astra for Media Collection, drawn in the style of each set. It is original artwork, not an adaptation of a pack icon (checked 2026-11-09: no path shared with the set's icons or the packs' leaf icons, pixel overlap no higher than with unrelated icons), so no pack licence or attribution applies; its origin is recorded in `design/artifact/icons/CREDITS.md` and `SOURCES-AND-LICENSES.json`. The credits page says that these icons were generated in the style of the sets.

The application must include a credits/licences page reachable without special permissions (Libris `/credits`, linked from the sign-in page and the sidebar; KI-6), listing every bundled icon pack, font, and other third-party asset with its author, licence, and required attribution, and stating when icons were modified. CC BY sets (01-04) require this attribution.

## Accessibility

Accessibility is a baseline requirement for Libris and Leaf: every control has a visible label or accessible name; all features work with the keyboard with a visible focus indicator; dialogs manage focus and can be closed with Escape; status (Owned, Lent, Read, errors, selection) is never conveyed by colour alone; text and controls meet WCAG AA contrast; images have meaningful alternative text; feedback messages are announced to assistive technology.

This supersedes the earlier hover-only decision for Activity timestamps: exact date/time and actor details appear on hover and on keyboard focus.

## Implementation references

[task-00-platform-ui-foundation](../plans/task-00-platform-ui-foundation.md), [task-01b-appearance-color-schemes](../plans/task-01b-appearance-color-schemes.md). See the [global implementation plan](../plans/implementation-plan.md) for status and resume instructions.
