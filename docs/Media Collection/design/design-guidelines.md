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

The Admin chooses the installation's colour scheme in Administration → Appearance; it applies to every account, in Libris and Leaf, including the sign-in page. It is a saved application preference: included in backups, and an Admin data reset returns it to the default. The four schemes come from the design's colour charts (`design/color-charts.html`) and differ only in three accent roles; neutral and status colours are shared.

| Scheme | Accent | Accent background (selected) | Accent text |
| --- | --- | --- | --- |
| Spring green (default) | #79D670 | #2B3E29 | #BDEBB8 |
| Mint | #86D39A | #2B3D31 | #B7E7C2 |
| Emerald | #65D59B | #273E32 | #B0E9CA |
| Forest | #65B881 | #293A30 | #AFD9BC |

The design screens were drawn in Mint. The local recovery window, which runs without the server, always uses Spring green.

## Window size

The minimum supported desktop size is 1280 x 720. The Electron window cannot be resized below it, and the desktop-browser layout is designed to remain fully usable at that size. Screens are drawn at 1440 px wide; between 1280 and 1440 px, secondary panels such as the selected-book panel narrow or move rather than clipping content. Leaf is designed for phone widths (reference 390 px).

## Icons

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

Every icon is the work of the authors of its pack; sets 01-05 were selected from these packs and recoloured or lightly adapted for Libris. Full credits, licence links, and the changes made are in `design/artifact/icons/CREDITS.md`, with per-icon provenance in `SOURCES-AND-LICENSES.json`. Each alternative set covers 24 named purposes (brand, navigation, lending, return, scan, states such as loading/error/empty/missing cover, and similar). Small utility icons that those sets do not provide, such as close, chevrons, check, add, edit, and delete, stay Lucide in every set.

The application must include a credits/licences page reachable without special permissions, listing every bundled icon pack, font, and other third-party asset with its author, licence, and required attribution, and stating when icons were modified. CC BY sets (01-04) require this attribution.

## Accessibility

Accessibility is a baseline requirement for Libris and Leaf: every control has a visible label or accessible name; all features work with the keyboard with a visible focus indicator; dialogs manage focus and can be closed with Escape; status (Owned, Lent, Read, errors, selection) is never conveyed by colour alone; text and controls meet WCAG AA contrast; images have meaningful alternative text; feedback messages are announced to assistive technology.

This supersedes the earlier hover-only decision for Activity timestamps: exact date/time and actor details appear on hover and on keyboard focus.

## Implementation references

[task-00-platform-ui-foundation](../plans/task-00-platform-ui-foundation.md), [task-01b-appearance-color-schemes](../plans/task-01b-appearance-color-schemes.md). See the [global implementation plan](../plans/implementation-plan.md) for status and resume instructions.
