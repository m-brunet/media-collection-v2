# Task 0 — Platform and UI foundation

Status: done (2026-11-03). Global plan: [implementation plan](implementation-plan.md).
Owning docs: [design-guidelines](../design/design-guidelines.md), [product-scope](../product/product-scope.md) (foundation/access), [release-expectations](../operations/release-expectations.md) (languages), [configuration](../operations/configuration.md).

## Goal

Turn the imported Electron Base foundation into the Media Collection platform that later tasks build on: product identity, default port, no demo feature, a styled and translated Libris shell, an empty Leaf site, per-user language, and frontend test tooling. No book/collection features yet. Accounts keep the foundation's current role model (admin/user) until Task 1.

## Decisions for this task

- **Web structure**: one Vite project in `apps/web`, two pages: `index.html` (Libris) and `leaf/index.html` (Leaf). Code in `src/libris/`, `src/leaf/`, `src/shared/` (ui components, i18n, icons, api, formatting). Built to `dist/apps/web/` and `dist/apps/web/leaf/`.
- **Serving**: server SPA fallback sends `/leaf` and `/leaf/*` to `leaf/index.html`, everything else (non-API, no extension) to `index.html`. Vite dev server gets the same fallback through a small plugin.
- **Routing**: `react-router` (declarative mode) in both apps; Leaf uses basename `/leaf`.
- **i18n**: in-house `Translator` class with typed catalogs (`en` is the reference; `fr` must define the same keys, enforced by TypeScript). `{name}` interpolation. React context + `useTranslation()` hook. No external i18n library.
- **Language preference**: new nullable `users.language` (`en` | `fr` | null). Null means "not chosen": the interface uses the device/browser language (English fallback). Before login, the device language is used with a selector (choice remembered in the browser). After login, the saved preference applies; changing language while signed in saves it to the account (`PATCH /api/account/language`, new `ChangeLanguage` use case). One user's choice never affects another.
- **Dates/times**: `DateTimeFormatter` class using `Intl` with the active language and the viewer's time zone (UTC storage already used).
- **Fonts**: `@fontsource/inter`, `@fontsource/space-grotesk`, `@fontsource/ibm-plex-mono` (OFL), bundled by Vite — no internet at runtime.
- **Icons**: `lucide-react` behind a shared `Icon` component using semantic names (`overview`, `my-books`, `account`, ...). Only the Lucide set now; the mapping is the extension point for Task 10 icon-set switching.
- **Design tokens**: CSS custom properties in `src/shared/ui/tokens.css` (colours, typography, spacing, radii, borders, focus ring), derived from the artifact. Component styles in `src/shared/ui/components.css`.
- **Components (only what is used now or immediately by Task 1)**: Brand (Libris/Leaf + "by Media Collection"), Icon, Button, TextField, SelectField, Notice (status/alert), Panel, PageHeader, Dialog (native `<dialog>`), EmptyState, LoadingState, LanguageSwitch, Libris AppShell with sidebar navigation.
- **Navigation now**: My account; Administration → Accounts, Server settings (admin only). Later tasks add their own entries; no placeholder pages for unbuilt features.
- **Leaf skeleton**: Leaf brand, sign-in, temporary-password notice (change it in Libris first; refined in Task 1), signed-in home with sign-out and language switch. Guest denial and mobile features come in Tasks 1 and 7.
- **Identity/branding**: package names `@media-collection/*`, root package `media-collection`; Electron app name and installer `Media Collection` (appId `com.mediacollection.app`, Linux executable `media-collection`); window/page titles `Libris` / `Leaf`; JWT issuer `media-collection`, audience `media-collection-web`.
- **Port**: default HTTP port 34345 (saved-setting default, Vite proxy, sample config, README, docs).
- **Window**: default 1440 x 900, minimum 1280 x 720.
- **Notes demo removal**: delete the `notes` server feature, web screen, contracts, fixtures and tests; migration `002-media-collection-foundation` drops `notes` and adds `users.language`. Tests that used Notes only as a sample protected resource are removed or rewritten against accounts. Packaged smoke test updated.
- **Testing tooling**:
  - Component tests: Vitest + `@testing-library/react` + `@testing-library/user-event` + `jsdom`, files `*.spec.tsx` next to components, jsdom via a Vitest project.
  - Browser e2e: `playwright` library driven from Vitest (`tests/web/*.e2e-spec.ts`), against the real backend runtime serving the built web app (existing `RuntimeFixture`). Chromium installed with `npx playwright install chromium` (documented in README). Viewports 1280x720, 1440x900, and 390x844 for Leaf.

## Steps

1. [x] Rename identity, port 34345, window size; update tests/docs referencing them.
2. [x] Remove Notes feature (server, web, contracts, fixtures, tests, packaged smoke) with migration 002.
3. [x] Language preference: domain/value object, use case + port, repository, controller endpoint, contracts; unit + API e2e tests.
4. [x] Web restructure: Vite multi-page, server and dev fallbacks, dependencies (react-router, lucide-react, fontsource, testing libs, playwright).
5. [x] Shared UI: tokens, fonts, components, i18n, formatter, icons; component tests.
6. [x] Libris shell and restyled existing screens (sign-in, password change, account, accounts admin, server settings), fully translated EN/FR.
7. [x] Leaf skeleton.
8. [x] Browser e2e tests (Libris sign-in/shell/language at two sizes, Leaf sign-in at phone size, `/leaf` deep-link serving); update desktop e2e.
9. [x] Docs: README (port, login, tests, browser install), configuration.md, design-guidelines status where relevant.
10. [x] Full `npm run check` from PowerShell, architecture review skill, commit, update global plan status.

## Acceptance for this task

- App, installer and windows show the new names; Libris shows "by Media Collection" under its name.
- Fresh install listens on 34345 by default; overrides still work.
- No Notes feature anywhere; existing data directories migrate cleanly.
- Libris and Leaf are served at `/` and `/leaf/` from one port, in dev and production.
- Pre-login language follows the device (fr → French, otherwise English) with a selector; signed-in language follows the saved preference and changing it persists for that user only.
- All UI text exists in English and French.
- Electron window cannot shrink below 1280 x 720; Libris is usable at that size.
- Component tests and browser e2e tests run inside `npm run check`.

## Outcome and notes for later tasks

- Full `npm run check` passes from PowerShell: 46 test files, 415 tests (unit, component/jsdom, API, SQLite, browser e2e with Playwright Chromium, Electron desktop).
- Server error messages are English sentences. The UI shows its own translated message per failure type (`ApiErrorMessage`, screen-specific overrides by HTTP status or failure code) plus client-side checks. **Later tasks should return stable error codes/keys** for rule-specific messages so they can be translated precisely.
- Electron desktop tests force English (`--lang=en-GB` in `tests/runtime/main-harness.mjs`) because the test machine is French.
- Browser tests: `tests/web/*.e2e-spec.ts`, helper `tests/web/browser.ts`; `MC_SCREENSHOT_DIR=<folder>` keeps screenshots for visual review.
- Component tests: `apps/web/src/**/*.spec.tsx`, fake API in `apps/web/src/testing/fake-api.test-support.ts`.
- Frontend libraries are `devDependencies` (bundled by Vite, kept out of the installer).
- Sign-out lives on My account (design); the sidebar shows identity and language only.
- The sign-in page still shows the foundation `admin / p@ssw0rd` first-startup hint; Task 1 replaces it with first-launch setup.
- Navigation entries are added per feature in `apps/web/src/libris/shell/app-shell.tsx` (`libraryItems`). `/` redirects to `/account` until Overview exists.
