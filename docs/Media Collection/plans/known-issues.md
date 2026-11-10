# Known issues and feedback

Bugs and improvement requests found during development or reported by the user, not done yet. Each entry has an
identifier, a type (**Bug** or **Improvement**), what was seen or asked, the cause when known, the intended fix and when
it is planned. Done entries move to **Done** with their commit, then are deleted once the change is released. Read this
list before starting a task: an open entry in the area a task touches is handled in that task.

**Design reference:** the Doop canvas **`shiKEeCX2V`** (doop.design). It replaces the Pen file
`design/media-collection-v3.pen` that older entries were written against: look up the same groups and frames by name on
the canvas. Pages exported from the canvas (for example `design/Page 40 · Overview.html`) sit in the Git-ignored
`design/` folder at the repository root; if the canvas or an export is missing, ask the user rather than inferring the
design.

| ID   | Type        | Title                                                                                 | Severity | Status |
| ---- | ----------- | ------------------------------------------------------------------------------------- | -------- | ------ |
| KI-1 | Bug         | The desktop window cannot be closed while the book form has unsaved changes           | Low      | Done   |
| KI-2 | Improvement | Libris sessions last 24 hours instead of one idle hour                                | Medium   | Done   |
| KI-3 | Improvement | Additional information uses the same numbered heading as the other book-form sections | Low      | Done   |
| KI-4 | Improvement | Libris has an application icon in the Windows taskbar                                 | Low      | Done   |
| KI-5 | Bug         | Bookshelves count not vertically centred with the search field                        | Low      | Done   |
| KI-6 | Improvement | Appearance: seven new colour schemes (Mint, Emerald, Forest removed) and the icon set choice | Medium | Done |
| KI-7 | Improvement | Interface text needs slightly wider letter spacing                                    | Low      | Done   |
| KI-8 | Improvement | Server settings addresses need more space between them                                | Low      | Done   |
| KI-9 | Improvement | Internet access: no automatic Let's Encrypt retries, estimated attempts left           | Medium   | Open   |
| KI-10 | Improvement | Internet access: renew certificates through ARI so renewals escape Let's Encrypt limits | Medium | Open |
| KI-11 | Improvement | Server settings: QR code for each address, opening Leaf, with the Libris logo | Medium | Done |
| KI-12 | Improvement | The address QR codes also sign the phone in to Leaf (not the HTTP internet address) | Medium | Open |
| KI-13 | Bug | Internet access: the router rule lapses while the panel still shows it on | High | Done |
| KI-14 | Improvement | Desktop dialogs, menus and window titles are only in English | Medium | Done |
| KI-15 | Bug | Activity: a shelf change and a tag change read as the same vague entry | Low | Done |
| KI-16 | Improvement | Internet access: the HTTP and HTTPS ports are chosen in Server settings and used outside too; 443 opens only for Let's Encrypt's check | Medium | Open |

## Open

### KI-9 — Internet access: no automatic Let's Encrypt retries, estimated attempts left

- **Type:** Improvement.
- **Reported:** 2026-11-08 by the user, after the Task 9.5 real-world check hit Let's Encrypt's limit (see Step 11 in
  [task-09-5-internet-access-https.md](task-09-5-internet-access-https.md)).
- **Let's Encrypt limits** ([rate limits](https://letsencrypt.org/docs/rate-limits/), updated 2026-08-05):
  - 5 certificates per exact set of identifiers (here: the public IP) per 7 days, refilled 1 every 34 hours, counted
    across all accounts, no override; only ARI renewals are exempt (KI-10).
  - 5 failed checks per identifier per account per hour, refilled 1 every 12 minutes, no override.
  - 1,152 consecutive failed checks per identifier per account (refilled 1 per day, reset by a success); then issuance
    for the address is paused until unpaused in Let's Encrypt's self-service portal.
- **Today:** the setup and **Check again** only try when the Admin asks. The hourly upkeep retries a failed renewal on
  its own, 1 hour after the first failure, then doubling up to 6 hours, whatever the reason; a rate-limit refusal is
  retried long before Let's Encrypt's `Retry-After` date. Nothing tells the Admin how many attempts remain.
- **Since KI-13 (2026-11-10, checked in the code):** the router rule is renewed on every upkeep run whatever the
  certificate back-off, and a router rule that is not kept is tried again after 1, 5 and 15 minutes; each outcome is
  logged. The certificate back-off itself (`RenewalPolicy.retryAt`) is unchanged and still treats every reason alike,
  although the ACME adapter already tells `rate-limited` from `not-reachable` (`acme-certificate-authority.adapter.ts`)
  and turns off `acme-client`'s silent `Retry-After` wait. The `Retry-After` date is not kept and no estimate exists.
  The fix below must keep the KI-13 router retries separate from the certificate attempts.
- **Fix:**
  - **No automatic retry of an attempt that cannot succeed:** after a rate-limit refusal, nothing is sent to
    Let's Encrypt before the `Retry-After` date it gave (stored and shown: "Try again after Monday 23:30"); after a
    failed check (port not reachable), the upkeep stops trying and waits for the Admin's **Check again**. Only
    failures that cost nothing (Let's Encrypt or the router unreachable) keep the current growing delays.
  - **Estimated attempts left, shown after the first failure:** from the app's own history of issued certificates and
    failed checks for the address, apply the two refill rules above: "About N certificates left this week for this
    address" and "About N checks left this hour". A rough estimate is enough; the panel says it is an estimate,
    because other software or another installation using the same address also counts (as the Task 9.5 incident
    did). At zero, the button explains when it becomes useful again instead of trying.
  - **Turn off** warns that setting internet access up again uses a certificate.
  - Tests: domain rules for the estimate (refill over time, zero, unknown history), the upkeep not calling the
    authority before `Retry-After` nor after a failed check, the panel texts in EN/FR.
- **Severity:** medium (a few retries can block internet access for days). **Planned:** next fix pass, or with
  KI-10.

### KI-10 — Internet access: renew certificates through ARI so renewals escape Let's Encrypt limits

- **Type:** Improvement.
- **Reported:** 2026-11-08 by the user.
- **Why:** an ARI renewal (ACME Renewal Information, RFC 9773) is exempt from **every** Let's Encrypt rate limit, as
  long as the new order names at least one identifier of the certificate it replaces and that certificate was not
  already replaced through ARI. A normal renewal of the same address counts toward the 5 per 7 days; with 6-day
  certificates renewed every ~3 days, that leaves little room for a setup, a turn off and on, or a failed attempt.
- **Checked:** `acme-client` 5.4.0 (the latest release, 2024-07) has no ARI support. Let's Encrypt production
  announces `renewalInfo` in its directory. `acme-client` passes order fields through unchanged (the app already adds
  `profile: 'shortlived'`), so ARI can be added in the adapter without changing library:
  - **Certificate identifier:** base64url of the Authority Key Identifier, a dot, base64url of the serial number
    (DER), read from the current certificate (`@peculiar/x509`, already a dependency of `acme-client`).
  - **Renewal order:** `replaces: <certificate identifier>` in `createOrder` when the address is unchanged.
  - **Renewal window (optional):** `GET <renewalInfo>/<certificate identifier>` (no account needed) gives the window
    Let's Encrypt suggests; the upkeep can renew inside it instead of at half-life, and earlier if Let's Encrypt asks
    (for example before a revocation).
- **Fix:** the authority port gets the certificate being replaced; the ACME adapter sends `replaces`; if
  Let's Encrypt refuses the field (certificate already replaced, unknown), retry once as a normal order. A new
  address is a new certificate, not a renewal, so it stays a normal order. Tests: the order carries `replaces` with
  the expected identifier (computed from a fixture certificate), the fallback, no `replaces` after an address change.
  Check against Let's Encrypt's staging server first.
- **Progress (checked 2026-11-10):** nothing done yet: no `replaces` or `renewalInfo` in the code, `acme-client` still
  5.4.0.
- **Severity:** medium (removes the main risk of the weekly limit). **Planned:** next fix pass, together with KI-9.

### KI-12 — The address QR codes also sign the phone in to Leaf (not the HTTP internet address)

- **Type:** Improvement.
- **Reported:** 2026-11-09 by the user, during Task 9.6.
- **Wanted:** scanning the QR code opens Leaf already signed in with the account of the user who displayed it, without
  typing the password on the phone.
- **Decisions (2026-11-09):**
  - **No new button:** it is the existing QR code of the addresses list (Server settings, KI-11, Task 9.6).
  - **Which addresses:** every address with a QR code signs the phone in, whatever the HTTPS state, **except the HTTP
    internet address** (`http://<domain or public IP>:<port>`), which keeps a plain QR code (the phone signs in with
    the password). Why:
    - HTTPS internet address: encrypted.
    - Local network addresses (`http://192.168.x.x`): only the home network carries the code; signing in there with
      the password already sends it unencrypted today, so a single-use 2-minute code adds no exposure.
    - Tailscale addresses (`http://100.x.x.x`): Tailscale encrypts the traffic between devices (WireGuard).
    - HTTP internet address: crosses public networks (shop Wi-Fi, mobile carrier) unencrypted, so excluded.
    - Loopback: no QR code already.
  - **Validity:** 2 minutes, single use (confirmed).
  - **Admin only, for now:** only the Admin sees the addresses list, so only the Admin can show such a QR code; the
    phone is signed in as the Admin. A way for Owners may come later.
  - **The phone session is a normal sign-in:** same account and rights as signing in with the password on the phone,
    same lifetime (24 idle hours, KI-2), ended like any session by a password change, a
    deactivation or the Admin recovery. No "Leaf only" limit and no device list.
- **Today:** the addresses list is in Server settings, so only the Admin sees it; the QR code holds
  `<address>/leaf/` (`apps/web/src/libris/administration/addresses-panel.tsx`). Sessions: HttpOnly cookies with a
  token version (`architecture.md`, security section).
- **Fix:**
  - **Pairing code:** when the user shows the QR code of an eligible address, Libris asks the server for a one-time
    code: random (32 bytes, base64url), only its hash stored with the account and an expiry of 2 minutes, usable once;
    showing the code again replaces the previous one. Feature `identity`: use cases "create a pairing code" (signed-in
    Admin) and "redeem a pairing code", a store (SQLite table with UUID id, hashed code, account, expiry, used
    at), audit categories for both.
  - **QR value:** `<address>/leaf/#pair=<code>`. The code is after `#`, so the browser never sends it in a request:
    it stays out of server logs and `Referer` headers. The server decides which addresses are eligible (it knows the
    HTTP internet address), so the rule is not left to the browser.
  - **Leaf:** on start, reads `#pair=`, removes it from the address bar at once (`history.replaceState`), and sends it
    once to a pre-login endpoint (for example `POST /api/sessions/pair`, CSRF like the login). The server checks the
    code (exists, not expired, not used, account active and Admin, no temporary password to change), marks it
    used, and opens the session exactly like a login (cookie, token version). Expired or used: Leaf shows its sign-in
    screen with "This QR code has expired. Show it again on the computer." Rate-limited like the login.
  - **Libris:** under the QR code of an eligible address, "This code signs a phone in as <username>. It works once,
    for 2 minutes." and a new code when it expires while shown. Under the HTTP internet address, nothing changes.
  - **Tests:** domain/application rules (expiry, single use, inactive account, temporary password, Owner and Guest
    refused), the
    redeem endpoint (success sets the session cookie, each refusal, rate limit, audit), Libris (the QR value has
    `#pair=` for local, Tailscale and HTTPS addresses, never for the HTTP internet address), a browser journey (scan value opened in a new context lands signed
    in on Leaf; second use refused). No test reaches Let's Encrypt (Task 9.6 testing rule).
- **Severity:** medium (sign-in on the phone at every session today). **Planned:** next version, after the 2.0.0
  release.
- **Progress (checked 2026-11-10):** nothing done yet: no pairing code in the server or in Leaf.

### KI-16 — Internet access: chosen HTTP and HTTPS ports used outside too; 443 opens only for Let's Encrypt's check

- **Type:** Improvement.
- **Reported:** 2026-11-10 by the user, after HTTPS from the internet worked with the domain name: phones should not
  reach Media Collection on the default HTTPS port 443 but on a port of the Admin's choice.
- **Wanted (the user, 2026-11-10):**
  - The HTTP port and the HTTPS port are set in Server settings, and each is **both the port on this computer and
    the outside port** on the router.
  - Defaults: **34345** for HTTP (as now) and **34443** for HTTPS (today: 3443 on this computer, 443 outside).
  - Phones open `https://<domain name or address>:<HTTPS port>`; addresses and QR codes show the port.
  - Port 443 is open only while Let's Encrypt checks the computer (option A below, chosen by the user).
- **Findings (checked in the code and the standards, 2026-11-10):**
  - **The certificate does not depend on the port:** it covers a name (`kaze-d.fr`) or an address. Changing ports
    reissues nothing.
  - **Let's Encrypt only checks on fixed ports:** TLS-ALPN-01 (used here) always connects to port 443 (RFC 8737),
    HTTP-01 to port 80, and DNS-01 needs the DNS provider's API. So 443 must be open at every check: each setup,
    each Check again, and each renewal (about every 60 days for a domain name, every 3 days for an IP address
    certificate). ARI renewals (KI-10) are still checked.
  - Options discussed: **A.** open 443 just before each check and close it right after (automatic with UPnP/NAT-PMP;
    with a rule added by hand, the Admin opens 443 at each renewal); **B.** keep 443 open for Let's Encrypt only;
    **C.** the DNS check (credentials and one integration per DNS provider). The user chose **A**.
  - **Today:** both ports are already settings, in Server settings › "Advanced: ports and manual certificate". HTTP
    internet access (Task 9.6) already uses the same port inside and outside (`HttpPortForwarding`). HTTPS uses the
    HTTPS port inside and the fixed `InternetAccess.externalPort = 443` outside; the address phones open is built
    without a port (`ReadInternetAccess`: `'https://' + certificateName`).
  - **Router rule:** the upkeep adds it again every hour with a 2-hour lease, so after an update to another outside
    port the new rule is added by the first upkeep and the old 443 rule usually lapses within 2 hours. A router that
    refuses leases gets a permanent rule (`ttl: 0`, `UpnpRouterGateway`): that old 443 rule must be removed
    explicitly. A rule added by hand is changed by the Admin only.
- **Proposed fix (to plan):**
  - **Settings:** HTTP and HTTPS ports shown in Server settings (outside the Advanced section), with a short note that
    the same port is opened on the router; HTTPS default 34443. Changing a port while internet access is on moves the
    listener and the router rule; no certificate is reissued.
  - **Router:** the permanent rule maps the HTTPS port outside to the same port on this computer. For each
    Let's Encrypt check, a temporary rule 443 → HTTPS port is opened just before the order and closed right after,
    success or failure (the HTTPS listener answers the TLS-ALPN-01 check as today); both logged. KI-13's router
    retries and KI-9's attempt rules stay as they are.
  - **Rule added by hand:** the manual rule screen gives the HTTPS port rule, and explains that 443 is needed only
    while Let's Encrypt checks (setup, Check again, renewals), with the date of the next renewal.
  - **Addresses:** the origin, the addresses list and the QR codes include the port when it is not 443.
  - **After the update (existing installations):** the old 443 → 3443 rule is removed once by the app; the panel says
    once that phones must open the new address (scan the QR code again); the saved HTTPS port is handled per open
    question 1.
  - **Tests:** domain rule for the outside port; the temporary 443 rule opened before and closed after a check (also
    after a refusal or an error); no 443 rule between checks; the origin with and without port; the one-time removal
    of the old rule; Server settings fields and texts in EN/FR.
- **Decided (the user, 2026-11-10):** existing installations move from 3443 to **34443** on update (the
  one-time step that removes the old 443 → 3443 rule also opens the new one).
- **Detecting a rule added by hand (checked 2026-11-10):** the app knows it is in that case (`mapping: 'manual'`:
  the router did not answer UPnP/NAT-PMP or refused the rule), but cannot see the rule itself: UPnP lists rules on
  some routers only, usually not those made in the router's web page, and testing 443 from outside would need an
  outside service. Since KI-9 a missing 443 rule costs one failed check, then the app waits for Check again.
- **Decided (the user, 2026-11-10): a reminder for a rule added by hand.** The panel shows the next renewal date with
  "Open port 443 on your router before {date}"; the Admin opens 443 in the router and may close it after the
  renewal. If forgotten, the renewal fails once (KI-9: the app then waits), the current certificate stays in use
  (about a month left for a domain name) and the panel asks to open 443 and Check again.
- **Decided (the user, 2026-11-10): an IP address without a domain name** renews every 3 days, so in that case only
  the panel advises a permanent 443 rule instead of the reminder.
- **Severity:** medium. **Planned:** to plan with the user (detailed plan to write).

## Done

### KI-14 — Desktop dialogs, menus and window titles are only in English

- **Type:** Improvement.
- **Found:** 2026-11-10, while bringing KI-1 over (its new "Unsaved changes" dialog follows the existing English-only
  ones). [Release expectations](../operations/release-expectations.md#languages) say the release supports English and
  French, so 2.0.0 should not ship them in English only.
- **Today:** Libris, Leaf and the Maintenance page are translated (the Maintenance page has its own EN/FR texts in
  `apps/desktop/assets/maintenance.js`, from the device language, with a selector). The texts drawn by the Electron
  main process are hard-coded in English:
  - `apps/desktop/src/main.ts`: the dialogs "Unsaved changes" (KI-1), "Server stopped" (Retry / Quit), "Server could
    not start" (its detail line; the message itself is the raw error) and "Local maintenance" (Stop the server and
    open maintenance / Cancel); the "Maintenance" menu and its "Open local maintenance…" item.
  - The standard menus built from Electron roles (File, Edit, View, Window and their items): Electron gives them
    English labels on Windows and Linux whatever the system language.
  - `apps/desktop/src/maintenance-window.adapter.ts`: the window title "Media Collection · Local maintenance", the
    save and open dialog titles "Create a backup" and "Restore a backup", the fallback "Maintenance failed.".
  - Error messages written by the backend process (`backend-process.adapter.ts`, `worker.ts`) that a dialog may show.
- **Possible:** yes, with no new dependency.
  - **Which language:** the device language, like the Maintenance page and the pre-login rule: French when
    `app.getPreferredSystemLanguages()` (or `app.getLocale()`) starts with `fr`, otherwise English. The signed-in
    person's saved language is not used: the main process has no business access to the account (business operations
    stay on HTTP, no business IPC), and these texts also appear before sign-in or with no account at all.
  - **How:** a small EN/FR catalogue class in `apps/desktop/src` (for example `DesktopTexts`, static, with the two
    languages side by side, like `maintenance.js`) used by every dialog, menu label and window title. Role menus keep
    their `role` (shortcuts, behaviour) and get a translated `label`. A raw error message stays as detail text;
    the dialog's own sentence is translated.
  - The Maintenance page and the main process should share the language rule, so one device shows one language.
- **Fix:** the catalogue and its use everywhere listed above, plus the texts Task 10 adds (menus "About Media
  Collection", "Check for updates…", "Exit", the About window, update dialogs), written translated from the start.
  Tests: a unit test of the catalogue (both languages have the same keys, French chosen for `fr-*`, English
  otherwise); a desktop e2e test checking one dialog and the menu labels in French (the test harness can set the
  language).
- **Severity:** medium (a French user sees English desktop dialogs; release requirement). **Planned:** Task 10, which
  reworks the menus and adds the About window and update dialogs.
- **Done:** 2026-11-10, Task 10 steps 2 to 6 (branch `docs/task-10-decisions`): `DesktopLanguage` and `DesktopTexts`
  in `apps/desktop/src`, used by every dialog, menu and window title; the Maintenance and About pages take the
  language from the main process. Tests: catalogue unit tests, desktop e2e tests on a French device (menus,
  maintenance confirmation, Maintenance and About windows, update dialogs).

### KI-15 — Activity: a shelf change and a tag change read as the same vague entry

- **Type:** Bug.
- **Found:** 2026-11-08 by the user, on the Libris Activity page; fixed the same day on the `known-issues-fix-pass`
  branch without an entry here. Entry written 2026-11-10 to track it.
- **Seen:** placing a book on a shelf and changing its tags both showed "You changed the location or tags of *Dune*"
  with the Books icon, so the entry did not say what had changed.
- **Cause:** both changes are audited as one category, `book.organised`, and the Activity projection gave it a single
  sentence (Task 8).
- **Fix:** the projection compares the recorded before and after states: only the shelf changed → "You changed the
  location of *Dune*" ("Vous avez modifié l’emplacement de *Dune*") with the Bookshelves icon; only the tags changed
  (order ignored) → "You changed the tags of *Dune*" ("Vous avez modifié les étiquettes de *Dune*") with the Tags
  icon; both, or a record that cannot tell → the general sentence as before. Older records are split too (no new
  audit data). [Task 8](task-08-overview-activity.md) sentence table updated. Tests: projection rules (location only,
  tags only, tags reordered, both), the API listing both kinds, the Activity page sentences and icons.
- **Severity:** low (wording). **Done:** 2026-11-10, branch `fix/known-issues-1-2-5-7`, commit `95378d3`
  (cherry-picked from `385f2db`, first written 2026-11-08).

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
- **Done:** 2026-11-10, branch `fix/known-issues-1-2-5-7`, commit `d110e84` (cherry-picked from the stale `known-issues-fix-pass`
  branch, first written 2026-11-08): the Libris window handles `will-prevent-unload` with a native
  dialog (Leave without saving / Stay, Stay by default). Quitting (application menu, signals) now closes the Libris
  window before stopping the server, so Stay keeps both the window and the server running. Desktop e2e tests: close the
  window and Leave; quit and Leave (server stopped); quit and Stay (window and server still running). The test harness
  can answer synchronous dialogs and give a page a user gesture. The dialog is in English, like the desktop's other
  dialogs.

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
- **Done:** 2026-11-10, branch `fix/known-issues-1-2-5-7`, commit `e2af329` (cherry-picked from the stale `known-issues-fix-pass`
  branch, first written 2026-11-08): 24 hours since the last authenticated action (the assumed answer to
  the open question). One lifetime, `SessionLifetime` (`apps/server/src/shared/domain/session-lifetime.helper.ts`),
  sets both the token expiry and the cookie `Max-Age`; renewal, passive requests and the token version check are
  unchanged. Tests: token valid at 23:59:59 and refused at 24 h, cookie `Max-Age=86400`, session kept just before 24
  idle hours and refused at 24 h, passive request 23 h 59 / 24 h 01 after renewal. `architecture.md` updated.

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
- **Done:** 2026-11-10, branch `fix/known-issues-1-2-5-7`, commit `31eb6cd` (cherry-picked from the stale `known-issues-fix-pass`
  branch, first written 2026-11-08): `.book-toolbar` centres its items; the Bookshelves count
  (`.book-toolbar__count`) stays on one line. My books and Collections are unchanged (their buttons and selects share
  the 44 px control height).

### KI-7 — Interface text needs slightly wider letter spacing

- **Type:** Improvement.
- **Reported:** 2026-11-08 by the user, first on the Libris sidebar (screenshot in French: Vue d’ensemble, Mes livres,
  Paramètres du serveur…): "The letter spacing could be a tiny bit bigger." Widened to all interface text after
  discussion the same day.
- **Today:** the body text (`body` in `apps/web/src/shared/ui/base.css`, `--font-body` Inter at `--text-base`) sets
  no `letter-spacing`, so menus, buttons, labels, fields and tables use the font's default (0), which is a little
  tight at 13–14 px. Already spaced and unchanged by this fix: section labels and other `.eyebrow` text (`0.06em`) and
  the elements in `components.css` with `0.02em`.
- **Fix:** one token in `apps/web/src/shared/ui/tokens.css` (for example `--tracking-body: 0.01em`) applied to `body`,
  so Libris and Leaf follow together. Headings (`--font-heading`, Space Grotesk), monospace text and the brand name
  keep their current spacing (set it back to `normal` on headings if they inherit it). Check the places where text is
  tight: the sidebar (long French labels such as "Paramètres du serveur"), buttons, table columns, the book form and
  Leaf at phone width, in English and French, at 1280 × 720 and 1440 wide.
- **Severity:** low (typography). **Planned:** next fix pass, or the next task that touches shared styles.
- **Done:** 2026-11-10, branch `fix/known-issues-1-2-5-7`, commits `37125e1` and `8563169` (cherry-picked from the stale `known-issues-fix-pass`
  branch, first written 2026-11-08): token `--tracking-body: 0.01em` on `body`; buttons, fields
  and selects inherit it (browsers reset it on form controls); every rule using the heading or monospace font sets
  `letter-spacing: normal` unless it already had its own spacing, including the QR code address added since by
  KI-11. Design guidelines updated (typography).

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
- **Done:** 2026-11-08, commit `9a0fed6` (branch `fix-additional-section-title`, PR #9): "03 / Additional information"
  ("03 / Informations complémentaires") in the green numbered label style, still the collapsible toggle; the Edit book
  form and Leaf's phone form use the same label. Confirmed in the code on 2026-11-10 (review of open entries).

### KI-13 — Internet access: the router rule lapses while the panel still shows it on

- **Type:** Bug.
- **Reported:** 2026-11-09 by the user: HTTP internet access no longer worked after the app had been closed for about
  8 hours, although Server settings showed it on. Turning it off and on again fixed it. The app runs in development
  sessions of about 20 minutes, on a wired computer.
- **Cause (likely; nothing is logged, so it cannot be confirmed afterwards):**
  - The UPnP rule is created with a 2-hour lease (`upnp-router-gateway.adapter.ts`) and renewed by the upkeep at
    startup, then every hour (`internet-access-upkeep.adapter.ts`). After 8 hours off, the router had dropped it, so
    the startup renewal was the only chance to bring it back.
  - Finding the router is fragile: `@xmcl/nat-api` sends a single SSDP search and gives up after 1.8 seconds, with no
    retry, although the search lets the router wait up to 1 second before answering. One missed answer fails the
    renewal.
  - After a failed renewal, the next one is an hour later, so a short session never gets a second try.
  - No renewal outcome is logged anywhere, so the cause of a failure cannot be found afterwards.
  - **HTTPS (not tested in real use yet, same upkeep):** the certificate back-off (1 hour, then doubling up to 6 hours,
    `RenewalPolicy.retryAt`) also skips the router rule renewal, so one failed upkeep, even a certificate or domain
    name problem, lets the 2-hour rule lapse until the back-off ends; restarting the app does not help.
- **Fix:**
  - Finding the router tries up to three times before the renewal counts as failed. The library also searched the
    router again on every call (its cache check is inverted), so one renewal ran two or three searches, each able to
    fail: the adapter now keeps the router it found for the rest of the call.
  - After a failed renewal, the upkeep tries again soon (1 minute, then 5, then 15) instead of an hour later; back to
    hourly once a renewal succeeds.
  - Each renewal outcome (HTTP and HTTPS, the startup one included) is written to the server log.
  - HTTPS: the router rule is renewed on every upkeep run, whatever the certificate back-off; only the certificate and
    domain name work waits for it.
  - Tests: the upkeep schedule (quick retries, back to hourly), the HTTPS rule renewed during the back-off, the router
    search retries. No test reaches a real router or Let's Encrypt.
- **Severity:** high (internet access silently stops working). **Planned:** now, its own fix branch.
- **Done:** branch `fix/internet-access-renewal` (PR #13 merged): commits `47b1504` (router search), `c4e7b96` (HTTPS rule during
  the back-off), `ccf5402` (quick retries, log).

### KI-6 — Appearance: seven new colour schemes (Mint, Emerald, Forest removed) and the icon set choice

- **Type:** Improvement.
- **Reported:** 2026-11-08 by the user. **Extended 2026-11-09:** the icon set choice (with the credits and licences
  page it needs) moved here from Task 10, so the whole Appearance update is done at once.
- **Asked:** the Admin's Appearance page (Task 1b) offers these schemes, taken from the design (Doop canvas
  `shiKEeCX2V`; first read from the former Pen file `design/media-collection-v3.pen`, whose group numbers are kept
  below):
  - **Spring green**, kept and still the default;
  - the **five dark schemes** of group 13 "Appearance collection — 10 non-green themes": Midnight blue, Velvet violet,
    Ember, Rose noir, Graphite gold;
  - group 14 "Dark Purple": **Slate × Orchid**;

  Display names (2026-11-09): Velvet violet is shown as "Desna’s reveries" and Slate × Orchid as "The Butterfly’s
  Way" (FR "Rêveries de Desna", "La Voie du papillon"); the design keeps its names, the identifiers stay
  `velvet-violet` and `slate-orchid`.
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
- **Icon sets (moved from Task 10, 2026-11-09):**
  - **Rule** ([design guidelines](../design/design-guidelines.md), icon sets): the Admin chooses the installation's
    icon set on the same Appearance page; it applies to every account, in Libris and Leaf, including before sign-in.
    Lucide is the default. It is a saved preference: in backups, back to Lucide after the Admin data reset (add it to
    `KyselyApplicationDataEraser.preferences`, next to `appearance`, see [Task 9](task-09-host-maintenance.md)).
  - **Sets:** 00 Lucide (ISC), 01 Solid silhouettes (game-icons.net, CC BY 3.0), 02 Hand-inked editorial sketches
    (Streamline Freehand, CC BY 4.0), 03 Architectural wireframes (Streamline Cyber, CC BY 4.0), 04 Single-ink
    risograph prints (Streamline Ultimate, CC BY 4.0), 05 Quiet editorial monoline (Iconoir, MIT). Each alternative set
    covers 25 named purposes; small utility icons (close, chevrons, check, add, edit, delete) stay Lucide in every set.
    The Libris icon never changes with the set.
  - **Turning leaf (added 2026-11-09):** a 25th purpose in every set, `turning-leaf.svg` in each set folder (from the Doop
    canvas `shiKEeCX2V`, "01 Turning leaf" of each style). Generated with GPT Astra in the style of each set; checked
    original on 2026-11-09 (no path shared with the set's icons or the leaf icons of Lucide, Iconoir and Game Icons;
    pixel overlap no higher than with unrelated icons), so no pack licence applies. Its origin is recorded in
    `design/artifact/icons/CREDITS.md`, `SOURCES-AND-LICENSES.json` and `manifest.json` (source
    `generated:gpt-astra`), and the credits page says these icons were generated in the style of the sets. Where Libris
    and Leaf show it: **decided 2026-11-09, the Turning leaf is Leaf's application icon and favicon** (and the mark
    next to the "Leaf" title). To build: Leaf's favicon, its home-screen icon (web app manifest and Apple touch icon,
    PNG sizes generated from the SVG) and its title mark, in Leaf only (Libris keeps its own icon). Version (decided
    2026-11-09): fixed like the Libris icon, the set 02 hand-inked Turning leaf
    (`02-hand-inked-editorial/turning-leaf.svg`) in Spring green `#79d670`, whatever the colour scheme or icon set. **Built 2026-11-09:** favicon `apps/web/public/leaf.svg`, home-screen icons and manifest from `tools/generate-leaf-icons.mjs`, linked from `apps/web/leaf/index.html`; the title marks of Libris and Leaf are drawn in the scheme's accent (`currentColor`, changed the same day), the files stay Spring green. Tests: the Leaf page links the favicon and the manifest,
    the manifest lists the icons, the title mark renders.
  - **Artwork:** `design/artifact/icons/` (six set folders, `manifest.json`, `CREDITS.md`,
    `SOURCES-AND-LICENSES.json`). The `design/` folder is Git-ignored: the shipped SVG files are copied into the web
    app with their credits.
  - **Today:** every icon goes through `apps/web/src/shared/ui/icon.tsx`, which only knows Lucide (the abstraction was
    made for set switching, Task 0).
  - **Colours (decided 2026-11-09, corrected the same day):** the icons follow the colour scheme the way Lucide does:
    they are drawn in the text colour (`currentColor`), so grey in a normal link and the accent in a selected one.
    The design's icons are single-colour (green, grey or gold by purpose); the only two-colour icon (set 03) keeps its
    second tone as the same colour at 60 % opacity. A first version drew the green in the accent and the grey in the
    secondary text colour, which did not follow the link state.
  - **Built so far (2026-11-09, branch `ki-6-appearance`):** the server setting (`icon-set`, public with the colour
    scheme, Admin only, audited `appearance.icon-set-changed`, reset to Lucide by the data reset); the import tool
    `tools/import-icon-sets.mjs` (recolours, prefixes ids, writes one static file per set,
    `apps/web/public/icon-sets/<set>.json`, with `CREDITS.md`); `Icon` drawing the chosen set and falling back to
    Lucide for utility icons and while the set loads (fetched once; a failed load is retried); the Appearance page
    "Icon set" panel with a preview per set. Purposes used by the interface today: overview, my books, collections,
    shelves, tags, lending, record return, activity, administration, settings, search, missing cover, success,
    loading, error, empty state, scan barcode, add book; the admin links (2026-11-09) use Administration for
    Accounts and Settings for Server settings, Appearance stays Lucide until its own artwork is generated (the user
    will provide it, with the same originality check as the Turning leaf). The screen-state purposes are used where
    those states appear: permission denied (Libris no-permission page), already owned and existing edition (Leaf,
    a scanned ISBN already in the library; the Libris book form's link to the existing book), camera unavailable
    (Leaf scan page), lookup offline (Find book notices when sources cannot be reached; `Notice` takes an icon). Not
    used: library brand (Libris keeps its own icon, Leaf takes the Turning leaf).
  - **Fix:**
    - **Server:** the icon set setting in the `appearance` feature (value object with the six names, unknown names
      refused, Lucide by default), read before sign-in like the colour scheme, saved by the Admin, audited.
    - **Web:** `Icon` picks the chosen set for the 24 purposes and falls back to Lucide for the others; the Appearance
      page shows each set with a preview of a few icons, names in EN/FR, Lucide marked as the default.
    - **Credits and licences page** (required by the CC BY sets 01-04): reachable without signing in, listing every
      bundled icon pack, font and third-party asset with author, licence, required attribution and whether it was
      modified: the icon sets (with a line saying the Turning leaf icons were generated in the style of the sets), the
      Libris icon (Streamline Freehand, CC BY 4.0, modified,
      `apps/desktop/assets/icons/CREDITS.md`), and the credits already listed in
      [Task 6](task-06-assisted-entry.md#credits-for-the-future-credits-page),
      [Task 7](task-07-leaf.md#credits-for-the-future-credits-page) and Task 9.5 (ACME client, NAT library, QR code
      library). Task 10's About window links to it. **Built 2026-11-09:** Libris `/credits` (on its own when signed
      out, inside the app when signed in), linked from the sign-in page and the bottom of the sidebar; data in
      `apps/web/src/shared/credits/credits.util.ts` (icons, fonts, book data sources, libraries), texts in EN/FR.
    - **Tests:** value object and use cases, API tests (setting, before sign-in, Admin only, audit), the data reset
      returning to Lucide, component tests (Appearance page, `Icon` with each set and the Lucide fallback, credits
      page), a browser journey choosing a set (Libris and Leaf).
- **Source:** the design as saved by the user on 2026-11-08 (groups 13 to 15 keep only these schemes), now on the Doop
  canvas `shiKEeCX2V`: find the groups by their names above and check the colours against the canvas before the fix. The light
  schemes are out of scope: Libris and Leaf are dark only.
- **Severity:** medium (visible choice, touches every screen's colours and icons). **Planned:** next fix pass,
  before Task 10.
- **Done:** 2026-11-09, branch `ki-6-appearance`, PR #12: commits `848a7d0` (docs), `e996672` (colour schemes and
  migration 011), `43c5a7b` and `6a434ef` (icon set setting and Appearance panel), `e65fdff` (Desna's reveries,
  The Butterfly's Way), `b30de03` (icons in the text colour), `73d81ab` (admin links), `a43a0a0` (credits page),
  `758d9ba` and `01e6ba8` (Leaf's icon, marks in the accent), `7887dd1` (screen-state icons), and the closing
  commit (tests, this entry). Open follow-up, outside KI-6: the Appearance artwork per icon set, when the user
  provides it.

### KI-11 — Server settings: QR code for each address, opening Leaf, with the Libris logo

- **Type:** Improvement (new feature).
- **Reported:** 2026-11-09 by the user, with the design
  [server-settings-ki11.html](../design/server-settings-ki11.html) (panel "Current addresses").
- **Asked:** each address of the "Current addresses" panel gets a **Show QR code** button. Clicking it shows, on the
  right of the list, the QR code of that address with a caption ("Scan to open this address") and the encoded address
  under it. The aim is to open Leaf on a phone without typing the address.
- **Decisions (user, 2026-11-09):**
  - **The QR code opens Leaf** (`<address>/leaf/`). The links on the left stay as today and open Libris (`<address>`).
    The text under the code shows the Leaf address it encodes.
  - **Nothing selected at first:** on page load no button is pressed and the QR side is hidden. A click on a button
    selects that address and shows its code; a click on another button switches to it. The pressed button is
    highlighted (`aria-pressed`), as in the design.
  - **No button for `localhost` and `127.0.0.1`** (loopback addresses, also `::1`): on a phone they point to the phone
    itself, so their code could never work. The links themselves stay.
  - **The Tailscale address (`100.64.0.0/10`) keeps its button, without a hint**: Tailscale users know they need it on
    the phone too.
  - **The Libris logo in the centre of the code** (`/libris.svg`, the official mark already used by `Brand`).
- **Feasibility and libraries:** no new dependency. `qrcode` 1.5.4 (added by Task 9.5 for the Internet access panel)
  generates the code locally as SVG. The design's image from `api.qrserver.com` is a mockup shortcut and must not be
  used: it would send the addresses to a third party, fail without internet access and break the content security
  policy.
- **The logo:** QR codes carry error correction; at level **H** (about 30 % of the code can be rebuilt) a centred logo
  of at most about 20 % of the code's width is read as recoverable damage. Rules: generate with
  `errorCorrectionLevel: 'H'`; the logo sits on a small white square in the centre, never over the three corner
  squares; the code keeps a white quiet zone (the design's 8 px white border plus the library margin; the Internet
  access panel's `margin: 1` is below the recommended 4 modules and should follow the same rule). Level H makes the
  code denser, so keep the design's 128 px display or larger and check with real phones.
- **Fix:**
  - One shared component (for example `AddressQrCode`) that draws a code for a URL, with the logo, used by the
    "Current addresses" panel and by the Internet access panel (which then also gets the logo), so both look the same.
  - The "Current addresses" panel follows the design: two columns (address list, QR preview of 300 px separated by a
    border), rows of at least 44 px with 16 px between them (this closes **KI-8**), the QR button style and focus
    outline, the caption and the encoded address in the mono font. At narrow widths the preview goes under the list.
    The "next addresses" list shown after an HTTP port change gets the same spacing, without buttons.
  - EN/FR texts: "Show QR code" / "Afficher le QR code", "Scan to open Leaf at this address" / "Scannez pour ouvrir
    Leaf à cette adresse", button labels "Show the QR code for <address>" for screen readers; the image alt text names
    the encoded address.
  - Credits (Task 10): "QR Code is a registered trademark of DENSO WAVE INCORPORATED."
- **Tests:** component tests: nothing selected and the preview hidden on load; a click shows the code for
  `<address>/leaf/` and presses only that button; a second click switches; no button for loopback addresses; the code
  is generated at level H with the logo present. Playwright on the reference desktop viewport: select an address,
  decode the displayed code (for example with the `zxing` reader the web app already ships for Leaf) and compare it to
  the expected Leaf address, so the logo is proven not to break scanning. A manual check with two phones.
- **Severity:** medium (main way to reach Leaf from a phone on the local network). **Planned:** next fix pass, with
  KI-8; it can follow Task 9.5's pull request.
- **Done:** 2026-11-09, commit `9e64d1f` (branch `ki-11-address-qr-codes`): `QrCode` (`apps/web/src/shared/ui/qr-code.tsx`,
  level H, 4-module margin, Libris mark at 20 % of the width) used by the new `AddressesPanel` and by the Internet
  access panel; `ServerAddress` (Leaf address, loopback detection). Browser tests decode the displayed codes with
  `zxing-wasm` (`tests/web/qr-reader.ts`). Still to do: the manual check with two phones; the credits line (Task 10).

### KI-8 — Server settings addresses need more space between them

- **Type:** Improvement.
- **Reported:** 2026-11-08 by the user, on the Libris Server settings page (French: "Adresses actuelles"), Task 9.5
  branch. The user likes how the addresses are shown, but the lines are too close together.
- **Today:** the addresses (`http://127.0.0.1:34345`, the Tailscale and local network addresses) are links in a
  `.plain-list` (`apps/web/src/libris/libris.css`), which only removes the list's margins and bullets, so the links sit
  line against line. The same list style holds the "next addresses" shown after an HTTP port change
  (`apps/web/src/libris/administration/server-settings-page.tsx`).
- **Fix:** space the items of both address lists, for example a dedicated class
  (`display: grid; gap: var(--space-2)`) instead of the bare `.plain-list`. Keep the current look of the links.
  Check on the reference desktop viewport, in both languages.
- **Severity:** low (readability). **Planned:** with KI-11, whose design gives the address rows 16 px spacing.
- **Done:** 2026-11-09, commit `9e64d1f` (branch `ki-11-address-qr-codes`, with KI-11): address rows of at least
  44 px with 16 px between them, in both address lists.

### KI-4 — Libris has an application icon in the Windows taskbar

- **Type:** Improvement.
- **Reported:** 2026-11-07 by the user.
- **Today:** no application icon is defined, in the specs or in the code: the desktop windows
  (`apps/desktop/src/main.ts`, `new BrowserWindow`) set no `icon`, so Windows shows the default Electron icon in the
  taskbar.
- **Decided (2026-11-08, user):** the library brand mark of the icon set **"02 · Hand-inked editorial sketches"**
  becomes the **official Libris icon**, everywhere Libris shows its mark: the taskbar and window icon of the desktop
  app, the mark next to the "Libris" title (`Brand`, `apps/web/src/shared/ui/brand.tsx`, Lucide `Library` today) and
  the favicon of the browser version. It is always drawn in the **Spring green** accent `#79d670`
  (`--scheme-accent` of `[data-color-scheme='spring-green']`, `apps/web/src/shared/ui/tokens.css`), whatever colour
  scheme or icon set is chosen. Leaf keeps its current mark and has no favicon yet: to be decided later.
- **Fix:** take `design/artifact/icons/02-hand-inked-editorial/library-brand.svg` (Git-ignored `design/` folder;
  Streamline Freehand icon `06-hand-inked/01` in `SOURCES-AND-LICENSES.json`), recolour it from its set ink `#86D39A`
  to `#79d670` and keep it as `apps/web/public/libris.svg`: the Libris page links it as its favicon and `Brand` shows it
  for Libris. Generate the desktop icon files from it (a Windows `.ico` with the usual sizes and a 512 px PNG for the
  other systems) into `apps/desktop/assets/icons` and pass them to every `BrowserWindow` (and the tray, if there is
  one). If `design/` is missing, ask the user for the file rather than redrawing it.
- **Licence:** the mark is "Freehand free icons" by Streamline (https://www.streamlinehq.com,
  https://github.com/webalys-hq/streamline-vectors), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/),
  recoloured and resized; it no longer comes from Lucide. Attribution is required: add it, with the licence link and the
  note that it was modified, to the credits page planned in Task 10 (wording in `design/artifact/icons/CREDITS.md`), and
  keep a `CREDITS.md` with the same attribution next to the icon files.
- **Done:** 2026-11-08, commit `b4e2f3d` (branch `ki-4-libris-icon`): `apps/web/public/libris.svg`, favicon, `Brand`
  for Libris, `apps/desktop/assets/icons` (`.ico`, PNG, `CREDITS.md`, generated by `tools/generate-libris-icons.mjs`)
  on both desktop windows. Still to do in Task 10: the credits page entry and the installer icon.
- **Severity:** low (appearance).
