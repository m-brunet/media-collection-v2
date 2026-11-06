# Known issues

Bugs found during development that are not fixed yet. Each entry records how to reproduce it, the cause when known,
the intended fix and when it is planned. Fixed entries move to the bottom with their commit, then are deleted once the
fix is released. Read this list before starting a task: an entry in the area a task touches is fixed in that task.

## Open

### KI-1 — The desktop window cannot be closed while the book form has unsaved changes

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

## Fixed

None yet.
