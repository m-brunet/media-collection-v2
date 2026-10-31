# Design references

This folder contains visual references for Media Collection v2. Product requirements take precedence over mockups; a final design direction does not settle open business rules.

## Current design package

Use [handoff-lending-final/HANDOFF.md](handoff-lending-final/HANDOFF.md) as the latest design inventory. Pen exported this package directly into this repository. It contains:

- `handoff-lending-final/media-collection-v2-final.pen`: saved editable document containing the earlier pages and the selected lending/return designs.
- `handoff-lending-final/screens/`: eleven screen exports, comprising six earlier pages and five new lending/return views.
- `handoff-lending-final/visual-reference.html`: static HTML/CSS reference.
- `handoff-lending-final/assets/covers/`: the required local mockup assets.

The native document parses as JSON and its 23 local cover references resolve. The HTML references resolve too. This structural check is not a full visual or product acceptance review, nor proof that every export matches the native canvas exactly.

The handoff identifies remaining gaps: no separate Guest, loading, validation, conflict, error, or success screen exports. These states remain required work where specified in the business/design brief. Some mockups include explanatory annotations about unresolved decisions; do not ship those annotations as application copy.

Read [lending rules](../docs/lending.md) and the [lending design brief](../docs/lending-design-brief.md) alongside the package. Activity grouping and other open questions are not resolved by this export. The earlier pages retain the known differences from v2 requirements listed below.

## Asset provenance and cleanup

`asset-manifest.json` preserves the cover source URLs, byte sizes, and SHA-256 hashes from the earlier external Media collection v3 handoff. Its paths now point to the retained `handoff-lending-final/assets/covers/` files. Obsolete `native_copy` paths were removed. All 23 retained assets match that provenance manifest.

The superseded root `screens/` and `reference/` directories were removed after duplication review. Five earlier screenshots and all 23 cover assets were byte-identical duplicates. The older Batman screenshot had minor pixel differences; both exports were visually reviewed and the newer handoff is retained as the current reference. The older HTML export is superseded by the complete handoff export. Earlier committed versions remain available in Git history; no external source files were changed.

All bundled covers are mockup placeholders only, for design review. They must never be used as application assets, demo seed data, or packaged production resources. Future lookup of a user's book cover is a separate feature.

## Not imported

- `source/last-saved-media-collection-v3.pen`: explicitly outdated in the original handoff.
- Main external `media-collection-v3.pen`: its synchronization with the original exported screens was not verified. Use the retained final handoff's native document for current design work instead.
- `review/all-screens.pdf`: duplicates the six screenshots.
- Duplicate cover directories used by the native snapshots.
- Original handoff prose: reconciled into the v2 docs rather than copied as a competing specification.

## How to use

Read [product scope](../docs/product-scope.md), [features](../docs/features.md), and [open questions](../docs/decisions-and-open-questions.md) first. They supersede conflicting mockup labels and older notes.

The screenshots were exported at twice their logical dimensions. Use the HTML for visual measurements only; it is not production application code. The app must adapt to its actual window size. This folder is documentation, not an application build input.

The visual direction is restrained dark surfaces, portrait covers without cropping, green accents, Inter body text, Space Grotesk headings, and occasional IBM Plex Mono labels. These are design references, not an implemented shared token system.

Known differences: physical bookcases/shelves replace virtual-category shelves; tags need UI design; ratings and reading goals are excluded; personal Read/Not read replaces the mockup's in-progress/progress model; mobile has a distinct limited scope and has no supplied layout.

Use ignored `design/local-reference/` only for temporary or unverified material. Approved sources should be explicitly documented and versioned, not silently kept in ignored files. No Git LFS configuration is needed for the selected reference set at this stage.
