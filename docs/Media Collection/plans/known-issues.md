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

## Done

None yet.
