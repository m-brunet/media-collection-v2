# Issue #21 — Internet ports: the chosen ports outside too, 443 only for Let's Encrypt's check

Status: **done** (2026-11-14). Decisions by the user on 2026-11-10 (GitHub issue #21, option A), plan approved on
2026-11-14. Branch `feat/internet-ports`, one pull request.

Owning docs: [Task 9.5](task-09-5-internet-access-https.md), [Task 9.6](task-09-6-internet-access-domain-name.md),
[release expectations](../operations/release-expectations.md), [product scope](../product/product-scope.md),
`operations/configuration.md`. Feature: `apps/server/src/server-settings`; Libris panels
`apps/web/src/libris/administration/ports-panel.tsx` and `internet-access-panel.tsx`.

## Decisions (the user, 2026-11-10 and 2026-11-14)

- The HTTP port and the HTTPS port are set in **Server settings › Ports**, outside the advanced section. Each port is
  both the port on this computer and the outside port on the router. Defaults: **34345** (HTTP) and **34443** (HTTPS).
- Phones open `https://<domain name or address>:<HTTPS port>`. The address list, the origin and the QR codes include
  the port when it is not 443 (the HTTPS port is never 443: ports start at 1024).
- **Option A:** port 443 is opened on the router only while Let's Encrypt checks the computer (TLS-ALPN-01 always
  connects to 443, RFC 8737): just before each setup, Check again or renewal (also an ARI renewal and a domain name
  change), and closed right after, whether the check succeeds, is refused or fails. Both steps are written to the log.
- A saved port change still applies at the next start of the desktop application. Until then the router rule and the
  checks keep the running HTTPS port; after the restart the upkeep moves the rule. No certificate is reissued: a
  certificate covers a name or an address, not a port.
- The HTTP port stays locked while HTTP from the internet is open (closing and opening it again costs nothing).
- **Update of an existing installation:** a saved HTTPS port of 3443 becomes 34443; any other saved port is kept. The
  first upkeep removes the former 443 → HTTPS port rule and opens the HTTPS port → same port rule. The panel then says
  once that phones need the new address (scan the QR code again), until the Admin closes the message.
- **Rule added by hand** (the router does not answer UPnP/NAT-PMP or refuses): the app cannot see the router's rules.
  The panel gives the permanent rule (HTTPS port → same port) and the port 443 rule for the checks.
  - With a domain name: "Open port 443 on your router before {date}", the next renewal date (two thirds of the
    lifetime); the Admin may close it after the renewal. If forgotten, the renewal fails once (KI-9: the app then
    waits), the current certificate stays in use and the panel asks to open 443 and Check again.
  - With an address only (renewed every 3 days): the panel advises a permanent 443 rule instead of the reminder.
- If the router refuses the temporary 443 rule, the check runs anyway (a rule added by hand may exist) and the refusal
  is logged.

## State and API

- `InternetAccess` saves `routerPort` (the outside port of the rule now open, `null` while off) and `addressMoved`
  (the new address message is due). Migration `014-internet-ports` moves 3443 to 34443 and records `routerPort: 443`
  for an internet access that is not off.
- `PUT /api/server-settings/https-port` `{ port }` saves the HTTPS port (Admin, CSRF, 1024–65535, not the HTTP port),
  also while internet access is on. Audit: `server-settings.https-port-changed`. `PUT /api/server-settings` (manual
  certificate) no longer takes a port.
- The internet access view adds `routerPort`, `addressMoved`, `renewalAt`, `manualRule` (HTTPS port → same port) and
  `checkRule` (443 → HTTPS port), both given for a rule added by hand.
- `DELETE /api/server-settings/internet-access/address-notice` closes the new address message.
- Log lines: `Let’s Encrypt check: port 443 opened on the router to port <port>`, `… the router refused to open port
  443, checking anyway`, `… port 443 closed on the router`, `Internet access: HTTPS router rule moved from port <old>
  to port <new>`.

## Acceptance examples

1. Set up internet access with the default ports and a router that accepts UPnP: the router has the rule 34443 →
   34443. During the certificate check it also has 443 → 34443; right after, 443 is closed. Libris lists
   `https://<address>:34443` and its QR code opens Leaf at that address.
2. A renewal runs (two thirds of a domain name certificate's lifetime): 443 is opened just before and closed right
   after, also when Let's Encrypt cannot reach the computer or is unavailable. The log shows both steps.
3. Between checks, the router has no 443 rule from Media Collection.
4. Update an installation that used 443 → 3443: after the restart the HTTPS port is 34443, the 443 rule is removed,
   34443 → 34443 is opened, and the panel says "The internet address is now https://<name>:34443. Scan the QR code
   again on each phone." Closing the message hides it for good.
5. Save HTTPS port 35000 while internet access is on: the message says to restart. Until the restart, phones keep
   using the former port. After the restart, the rule moves to 35000 and the address shows `:35000`. No certificate is
   requested.
6. Save the HTTP port as the HTTPS port (or the reverse): refused, "HTTP and HTTPS must use different ports."
7. The router refuses the rule: the panel shows the rule 34443 → this computer : 34443, and the port 443 rule for the
   checks. With a domain name, once active: "Open port 443 on your router before {date}". Without one: keep port 443
   open permanently.
8. An Owner or a Guest saving the HTTPS port or closing the new address message gets `403`.
