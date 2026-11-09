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
| KI-1 | Bug         | The desktop window cannot be closed while the book form has unsaved changes           | Low      | Open   |
| KI-2 | Improvement | Libris sessions last 24 hours instead of one idle hour                                | Medium   | Open   |
| KI-3 | Improvement | Additional information uses the same numbered heading as the other book-form sections | Low      | Open   |
| KI-4 | Improvement | Libris has an application icon in the Windows taskbar                                 | Low      | Done   |
| KI-5 | Bug         | Bookshelves count not vertically centred with the search field                        | Low      | Open   |
| KI-6 | Improvement | Appearance: seven new colour schemes (Mint, Emerald, Forest removed) and the icon set choice | Medium | Open |
| KI-7 | Improvement | Interface text needs slightly wider letter spacing                                    | Low      | Open   |
| KI-8 | Improvement | Server settings addresses need more space between them                                | Low      | Done   |
| KI-9 | Improvement | Internet access: no automatic Let's Encrypt retries, estimated attempts left           | Medium   | Open   |
| KI-10 | Improvement | Internet access: renew certificates through ARI so renewals escape Let's Encrypt limits | Medium | Open |
| KI-11 | Improvement | Server settings: QR code for each address, opening Leaf, with the Libris logo | Medium | Done |
| KI-12 | Improvement | The address QR codes also sign the phone in to Leaf (not the HTTP internet address) | Medium | Open |

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
    (`02-hand-inked-editorial/turning-leaf.svg`) in Spring green `#79d670`, whatever the colour scheme or icon set. Tests: the Leaf page links the favicon and the manifest,
    the manifest lists the icons, the title mark renders.
  - **Artwork:** `design/artifact/icons/` (six set folders, `manifest.json`, `CREDITS.md`,
    `SOURCES-AND-LICENSES.json`). The `design/` folder is Git-ignored: the shipped SVG files are copied into the web
    app with their credits.
  - **Today:** every icon goes through `apps/web/src/shared/ui/icon.tsx`, which only knows Lucide (the abstraction was
    made for set switching, Task 0).
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
      library). Task 10's About window links to it.
    - **Tests:** value object and use cases, API tests (setting, before sign-in, Admin only, audit), the data reset
      returning to Lucide, component tests (Appearance page, `Icon` with each set and the Lucide fallback, credits
      page), a browser journey choosing a set (Libris and Leaf).
- **Source:** the design as saved by the user on 2026-11-08 (groups 13 to 15 keep only these schemes), now on the Doop
  canvas `shiKEeCX2V`: find the groups by their names above and check the colours against the canvas before the fix. The light
  schemes are out of scope: Libris and Leaf are dark only.
- **Severity:** medium (visible choice, touches every screen's colours and icons). **Planned:** next fix pass,
  before Task 10.

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
    same lifetime (one idle hour today, 24 hours with KI-2), ended like any session by a password change, a
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

## Done

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
