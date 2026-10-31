# Design references

These files are visual references for Media Collection v2, imported from the `coding-agent-handoff` in the external Media collection v3 design folder on 2026-10-31. The original files remain untouched.

## Included

- `screens/`: six current exported views: My books, Overview, Shelves, Activity, Collections, and collection details (Batman).
- `reference/design.html`: the exported static HTML/CSS reference.
- `reference/assets/covers/`: image dependencies required by that HTML.
- `asset-manifest.json`: original cover provenance manifest. Its `native_copy` paths refer to the external handoff's omitted source folder and do not exist here.

The original handoff identifies these PNG/HTML exports as current at export time. That does not make every depicted feature an approved v2 requirement. Their visual appearance was not independently revalidated during this documentation import.

All bundled covers are mockup placeholders only, for design review. They must never be used as application assets, demo seed data, or packaged production resources. Future lookup of a user's book cover is a separate feature.

## Not imported

- `source/last-saved-media-collection-v3.pen`: explicitly outdated in the original handoff.
- Main external `media-collection-v3.pen`: a different file exists, but its synchronization with the exported screens has not been verified. Do not designate an authoritative editable source until confirmed.
- `review/all-screens.pdf`: duplicates the six screenshots.
- Duplicate cover directories used by the native snapshots.
- Original handoff prose: reconciled into the v2 docs rather than copied as a competing specification.

## How to use

Read [product scope](../docs/product-scope.md), [features](../docs/features.md), and [open questions](../docs/decisions-and-open-questions.md) first. They supersede conflicting mockup labels and older notes.

The screenshots were exported at twice their logical dimensions. Use the HTML for visual measurements only; it is not production application code. The app must adapt to its actual window size. This folder is documentation, not an application build input.

The visual direction is restrained dark surfaces, portrait covers without cropping, green accents, Inter body text, Space Grotesk headings, and occasional IBM Plex Mono labels. These are design references, not an implemented shared token system.

Known differences: physical bookcases/shelves replace virtual-category shelves; tags need UI design; ratings and reading goals are excluded; personal Read/Not read replaces the mockup's in-progress/progress model; mobile has a distinct limited scope and has no supplied layout.

Use ignored `design/local-reference/` only for temporary or unverified material. Approved sources should be explicitly documented and versioned, not silently kept in ignored files. No Git LFS configuration is needed for the selected reference set at this stage.
