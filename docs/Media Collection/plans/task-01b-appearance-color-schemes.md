# Task 1b — Appearance: colour schemes

Status: done (2026-11-04). Requested by the user between Tasks 1 and 2. Global plan: [implementation plan](implementation-plan.md).
Source: `design/color-charts.html` / `design/color-charts.css` (design artifact, local copy).

## Goal

The administrator chooses the installation's colour scheme among four; the choice applies to everyone, in Libris and Leaf, including before sign-in. Default: Spring green (the design so far used Mint).

## Decisions

- Schemes and their three accent roles (all neutral and status colours stay identical):

| Scheme | id | accent | accent background (selected) | accent text (light) |
| --- | --- | --- | --- | --- |
| Mint | `mint` | #86D39A | #2B3D31 | #B7E7C2 |
| Emerald | `emerald` | #65D59B | #273E32 | #B0E9CA |
| Forest | `forest` | #65B881 | #293A30 | #AFD9BC |
| Spring green (default) | `spring-green` | #79D670 | #2B3E29 | #BDEBB8 |

- New backend feature `appearance`: value object `ColorScheme`; port `AppearanceStore` (saved in the existing `server_settings` table under `appearance`); use cases `ReadAppearance` (public: needed before sign-in) and `SaveAppearance` (Admin only, audited `appearance.color-scheme-changed`). Endpoints `GET /api/appearance` (public), `PUT /api/appearance` (admin).
- It is a saved application preference: included in backups, and an Admin data reset (Task 9) returns it to Spring green.
- Frontend: `tokens.css` maps `--color-accent`, `--color-selected`, `--color-accent-strong`, `--color-focus` and the success surface per `html[data-color-scheme]`, Spring green by default. Both apps fetch the appearance at start and set the attribute; the last scheme is remembered in browser storage and applied before the first paint to avoid a colour flash.
- Libris: Administration → "Appearance" page with the four schemes as a radio group with swatches and a preview; saving applies immediately to the admin's window, other open windows on next load.
- Local recovery window (static page without server) uses the Spring green default.
- Task 10 adds the icon-set choice to the same Appearance page.

## Steps

1. [x] Backend feature (domain, application, persistence, controller, module, wiring) with unit, API and SQLite tests.
2. [x] Frontend tokens per scheme, startup loading, Appearance page, EN/FR texts, component tests.
3. [x] Browser e2e: default Spring green, admin switches to Mint, scheme visible to a signed-out visitor.
4. [x] Docs (design guidelines, product scope), full check, architecture review, commit, plan status.

## Outcome

- Full `npm run check` from PowerShell: 64 test files, 570 tests.
- Frontend: `AppearanceProvider` (shared/appearance) wraps both apps; `ColorSchemeDocument.restore()` runs before render. KI-6 adds the icon set to `appearance-page.tsx` and the `appearance` feature (moved from Task 10, 2026-11-09).

## Note (2026-11-09, KI-6)

The four accent-only schemes of this task are replaced by eight full palettes (Spring green and seven schemes from the design); Mint, Emerald and Forest are removed, with migration 011 moving a saved choice to Spring green. See [design guidelines](../design/design-guidelines.md#colour-schemes) and KI-6 in [known issues](known-issues.md).
