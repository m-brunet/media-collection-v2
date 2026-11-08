# Known issues and feedback

Bugs and improvement requests found during development or reported by the user, not done yet. Each entry has an
identifier, a type (**Bug** or **Improvement**), what was seen or asked, the cause when known, the intended fix and when
it is planned. Done entries move to **Done** with their commit, then are deleted once the change is released. Read this
list before starting a task: an open entry in the area a task touches is handled in that task.

| ID   | Type        | Title                                                                                 | Severity | Status |
| ---- | ----------- | ------------------------------------------------------------------------------------- | -------- | ------ |
| KI-1 | Bug         | The desktop window cannot be closed while the book form has unsaved changes           | Low      | Open   |
| KI-2 | Improvement | Libris sessions last 24 hours instead of one idle hour                                | Medium   | Open   |
| KI-3 | Improvement | Additional information uses the same numbered heading as the other book-form sections | Low      | Open   |
| KI-4 | Improvement | Libris has an application icon in the Windows taskbar                                 | Low      | Open   |
| KI-5 | Bug         | Bookshelves count not vertically centred with the search field                         | Low      | Open   |
| KI-6 | Improvement | Appearance offers seven new colour schemes; Mint, Emerald and Forest are removed        | Medium   | Open   |
| KI-7 | Improvement | Sidebar navigation labels need slightly wider letter spacing                          | Low      | Open   |

## Open

### KI-1 — The desktop window cannot be closed while the book form has unsaved changes

- **Type:** Bug.
- **Found:** 2026-11-06 by the user, on the Task 6 branch (cause predates Task 6).
- **Reproduce:** in the desktop app, open Add a book, fill a few fields, close the window: nothing happens.
- **Cause:** the book form warns before leaving with unsaved changes through the browser's `beforeunload` event
  (`apps/web/src/libris/books/book-form-page.tsx`, since Task 2). A browser shows its own "Leave this page?" prompt;
  Electron shows nothing and silently cancels the close unless the main process handles `will-prevent-unload`, which
  `apps/desktop/src/main.ts` does not.
- **Fix:** handle `will-prevent-unload` on the Libris window: show a native dialog (Leave without saving / Stay) and
  call `event.preventDefault()` on Leave so the window closes. Desktop e2e test: fill the form, close, choose Leave.
  Also check that quitting from the tray or the application menu behaves the same.
- **Severity:** low (the person can save or clear the form first). **Planned:** next fix pass, or the next task that
  touches the desktop shell.

### KI-2 — Libris sessions last 24 hours instead of one idle hour

- **Type:** Improvement.
- **Reported:** 2026-11-07 by the user: the Libris session is too short; signing out should happen only after 24 hours.
- **Today:** a session ends after one idle hour; authenticated actions renew it (`architecture.md`, security section).
  The hour is set in two places: the token expiry in
  `apps/server/src/identity/infrastructure/adapters/driven/security/jwt-session-tokens.adapter.ts`
  (`setExpirationTime(now + 3600)`) and the cookie lifetime in
  `apps/server/src/shared/infrastructure/adapters/driving/web/http-sessions.service.ts` (`maxAge: 3_600_000`).
- **Fix:** one shared session lifetime of 24 hours used by both the token and the cookie, keeping renewal on
  authenticated actions, passive requests not renewing, and the token version check after password changes. Update
  `architecture.md` ("idle hour" becomes 24 hours). Tests: token expiry and cookie `Max-Age` at 24 hours; a session is
  still valid just before 24 idle hours and refused just after (with the test clock). Leaf shares the same session.
- **Open question for the fix:** 24 hours since the last activity (renewed, as today), or 24 hours after sign-in
  whatever the activity. The first is assumed unless the user says otherwise.
- **Severity:** medium (frequent sign-ins during normal use). **Planned:** next fix pass.

### KI-3 — Additional information uses the same numbered heading as the other book-form sections

- **Type:** Improvement.
- **Reported:** 2026-11-07 by the user, on the Libris book form.
- **Today:** "01 / Main information" and "02 / Location & tags · Optional" use the panel label style (small green
  numbered heading, `Panel label`). "Additional information" is a large white heading with an arrow
  (`apps/web/src/libris/books/book-additional-fields.tsx`, `book-form__toggle-heading`), so it looks unlike the others.
- **Fix:** give it the same green numbered label, "03 / Additional information" ("03 / Informations
  complémentaires"), in the same font and style as the other two sections. **Keep it collapsible**, unlike the other
  sections: the label itself stays the expand/collapse button (with its arrow, `aria-expanded` and the closed hint).
  Check the Edit book form too, and whether Leaf's phone form should follow.
- **Severity:** low (visual consistency). **Planned:** next fix pass, or the next task that touches the book form.

### KI-4 — Libris has an application icon in the Windows taskbar

- **Type:** Improvement.
- **Reported:** 2026-11-07 by the user.
- **Today:** no application icon is defined, in the specs or in the code: the desktop windows
  (`apps/desktop/src/main.ts`, `new BrowserWindow`) set no `icon`, so Windows shows the default Electron icon in the
  taskbar.
- **Fix:** until the specs define one, use the mark shown next to the "Libris" title (`Brand`,
  `apps/web/src/shared/ui/brand.tsx`: the Lucide `Library` icon) drawn in the green accent colour (`--color-accent`,
  default scheme `#79d670`). Generate the icon files from the Lucide SVG (a Windows `.ico` with the usual sizes, and PNGs
  for the other systems), keep them in `apps/desktop/assets`, and pass them to every `BrowserWindow` (and the tray, if
  there is one). Lucide is ISC-licensed: add it to the credits page planned in Task 10. Check whether the web pages
  should use the same mark as their favicon (Libris and Leaf).
- **Severity:** low (appearance). **Planned:** next fix pass, or Task 10 (packaging and installer), whichever comes
  first; the installer icon should use the same files.

### KI-5 — Bookshelves count not vertically centred with the search field

- **Type:** Bug.
- **Reported:** 2026-11-08 by the user, on the Libris Bookshelves page (French: "1 bibliothèque · 2 étagères").
- **Seen:** the count of bookcases and shelves on the right of the search field sits at the top of the row instead of
  being centred on the 44 px search field.
- **Cause:** the page reuses the `.book-toolbar` row (`apps/web/src/libris/libris.css`), a flex row without
  `align-items`, so the count (`<span className="muted">` in `apps/web/src/libris/locations/bookshelves-page.tsx`)
  stretches to the field's height and its text stays at the top.
- **Fix:** centre the items of that row (`align-items: center` on `.book-toolbar`, or on a Bookshelves-specific
  modifier). Check that My books and Collections, which use the same row with a sort selector, still look right, and
  keep the count from wrapping (`white-space: nowrap`). Component test not useful (layout); check it in the browser at
  1280 × 720 and 1440 wide, in English and French.
- **Severity:** low (visual alignment). **Planned:** next fix pass, or the next task that touches the Bookshelves page.

### KI-6 — Appearance offers seven new colour schemes; Mint, Emerald and Forest are removed

- **Type:** Improvement.
- **Reported:** 2026-11-08 by the user.
- **Asked:** the Admin's Appearance page (Task 1b) offers these schemes, taken from the design file
  `design/media-collection-v3.pen`:
  - **Spring green**, kept and still the default;
  - the **five dark schemes** of group 13 "Appearance collection — 10 non-green themes": Midnight blue, Velvet violet,
    Ember, Rose noir, Graphite gold;
  - group 14 "Dark Purple": **Slate × Orchid**;
  - group 15 "Red study": **Warm charcoal × Soft scarlet**.

  **Mint, Emerald and Forest are removed.**
- **Today:** a scheme only changes three accent colours (`--scheme-accent`, `--scheme-accent-background`,
  `--scheme-accent-text` in `apps/web/src/shared/ui/tokens.css`); surfaces, borders and text are shared. The new
  schemes also change the backgrounds, borders and text, so a scheme becomes a full palette. Names live in the
  `ColorScheme` value object (`apps/server/src/appearance/domain/value-objects/color-scheme.value-object.ts`), the web
  list (`apps/web/src/shared/appearance/color-scheme-document.util.ts`, `appearance-context.tsx`), the Appearance page
  and the EN/FR catalogues.
- **Colours read from the design** (page background, sidebar, panel, control, border, text, secondary text, accent,
  accent background):

  | Scheme | Background | Sidebar | Panel | Control | Border | Text | Secondary text | Accent | Accent background |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Midnight blue | `#191F2C` | `#121721` | `#151B26` | `#252E3D` | `#3D4F6B` | `#F0F5FF` | `#ABBBD2` | `#8BB8FF` | `#10213B` |
  | Velvet violet | `#201C28` | `#16131C` | `#191620` | `#2E2739` | `#514361` | `#F7F0FF` | `#BFB0CF` | `#C4A3FF` | `#27133F` |
  | Ember | `#27201D` | `#1C1614` | `#1F1916` | `#372E28` | `#604A3D` | `#FFF3E9` | `#CDB7A7` | `#FFAD79` | `#361B0C` |
  | Rose noir | `#261E24` | `#1A1419` | `#1F191F` | `#362C33` | `#5C4354` | `#FFF0F7` | `#CEAFBF` | `#F3A4C4` | `#371425` |
  | Graphite gold | `#242424` | `#171717` | `#1D1D1D` | `#323232` | `#505050` | `#F7F5EE` | `#BCBAB2` | `#E4C56B` | `#2C240C` |
  | Slate × Orchid | `#252B32` | `#191F26` | `#20262D` | `#343D47` | `#4D5C6A` | `#F3F6FA` | `#B6C1CD` | `#D7ACFF` | `#301B40` |
  | Warm charcoal × Soft scarlet | `#272426` | `#1B191A` | `#211F20` | `#343032` | `#51484C` | `#FFF2F1` | `#D0B2B7` | `#FF9994` | `#3A1719` |

  The design does not give every role (accent text on the accent background, focus ring, muted text, status
  colours): derive them per scheme and check WCAG AA contrast for each, as Task 1b did for the green schemes.
- **Fix:**
  - **Server:** new scheme names in `ColorScheme`, the three removed names refused. Migration: an installation that
    saved Mint, Emerald or Forest switches to Spring green (no error, no prompt).
  - **Web:** one token block per scheme with all the colours above, applied to Libris and Leaf, including before
    sign-in (as today). Hard-coded neutral colours in the CSS that should follow the scheme are moved to tokens.
  - **Appearance page:** a preview swatch per scheme (background with its accent), names in EN/FR, Spring green
    marked as the default.
  - **Tests:** domain and use-case tests (new names, removed names refused, migration of a removed choice), API tests
    for the setting, component tests for the Appearance page, a browser journey choosing a new scheme (Libris and
    Leaf), and a contrast check of the text and accent pairs of every scheme.
  - Update the design guidelines (colour schemes) and the Task 1b notes.
- **Source:** the design file as saved by the user on 2026-11-08 (groups 13 to 15 keep only these schemes). The light
  schemes are out of scope: Libris and Leaf are dark only.
- **Severity:** medium (visible choice, touches every screen's colours). **Planned:** next fix pass, or Task 10 with
  the icon sets on the same Appearance page, whichever comes first.

### KI-7 — Sidebar navigation labels need slightly wider letter spacing

- **Type:** Improvement.
- **Reported:** 2026-11-08 by the user, on the Libris sidebar (screenshot in French: Vue d’ensemble, Mes livres,
  Collections, Bibliothèques, Étiquettes, Prêts, Activité, Comptes, Apparence, Paramètres du serveur).
- **Asked:** "The letter spacing could be a tiny bit bigger."
- **Today:** the navigation links (`.nav-link` in `apps/web/src/libris/libris.css`) set no `letter-spacing`, so they
  use the font's default (0). The section labels ("BIBLIOTHÈQUE PARTAGÉE", "ADMINISTRATION") are `.eyebrow`
  (`apps/web/src/shared/ui/base.css`, already `0.06em`).
- **Fix:** a small positive spacing on the navigation labels, for example `letter-spacing: 0.01em`–`0.02em` on
  `.nav-link` (the footer links My account / Sign out use the same class), ideally as a token in `tokens.css`. Check
  that long French labels ("Paramètres du serveur") still fit the 232 px sidebar without extra wrapping, at
  1280 × 720 and 1440 wide, and whether Leaf's menus should follow. Assumed: only the navigation labels, not the
  section labels or the "Libris" brand; confirm with the user if in doubt.
- **Severity:** low (typography). **Planned:** next fix pass, or the next task that touches the Libris shell.

## Done

None yet.
