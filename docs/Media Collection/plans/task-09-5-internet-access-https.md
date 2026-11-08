# Task 9.5 — Internet access and HTTPS setup

Status: plan approved (2026-11-08), in progress. Branch `task-09-5-internet-access-https`, pull
request at the end. Global plan: [implementation plan](implementation-plan.md).

Owning docs: [product scope](../product/product-scope.md) (internet access, port constraints),
[release expectations](../operations/release-expectations.md) (connectivity, transport),
[configuration](../operations/configuration.md) (TLS key storage), [architecture](../architecture/architecture.md)
(storage, identity and transport: "No certificate issuance" changes with this task). Step 1 updates them.

## Goal

Leaf is used while out shopping, so the installation must be reachable from the internet over HTTPS. Today the
Admin pastes a PEM certificate and private key in the server settings, and sets up port forwarding on the router
alone. Both need technical knowledge. The goal is one action, **Set up internet access**, that needs no knowledge
from the user: it opens the router port, gets a trusted certificate, renews it, and gives the phone its address.

## Scope

In:

- **Set up internet access** (Admin, Server settings page): router port rule through UPnP or NAT-PMP, connection
  check (CGNAT, double NAT), Let's Encrypt **IP address certificate**, HTTPS switched on live, address and QR code for
  the phone. A guided manual screen when the router cannot be configured automatically.
- **Automatic upkeep** while the app runs: router rule refreshed, certificate renewed and swapped live, new public IP
  followed (new certificate, new address shown).
- **Turn off internet access**: router rule removed, renewals stopped.
- **Keep this computer awake while Media Collection runs** (desktop setting, off by default).
- Manual PEM certificate import kept, moved to an **Advanced** section.
- EN/FR strings, audit, tests at every level, documentation.

Out: dynamic DNS names (option B), tunnels (option C), a name service run by Media Collection (option D), the Windows
installer firewall rule (Task 10 builds the installer and adds it), HTTP→HTTPS redirects, HSTS, IPv6 port opening.

## Why a certbot-style button is not enough on its own

Let's Encrypt needs a public name (a domain, or since 2026-01-15 a public IP address) and a proof of control:

- HTTP-01 on external port 80, or TLS-ALPN-01 on external port 443, checked from the internet;
- or DNS-01, a TXT record created through a DNS provider's API (domain names only, not IP addresses).

A household has no domain. Its public IP address is usable, but only with the port 443 proof. The app keeps listening
on a port from 1024 to 65535: the router forwards **external** port 443 to it (for example 443 → 3443), so one
forwarding rule is still enough.

Port forwarding is the harder step for users. A working forward needs:

1. a router rule from the external port to the host's local IP and the app's HTTPS port;
2. a host local IP that does not change (DHCP can reassign it);
3. Windows Firewall allowing incoming connections to the app (a "public" network profile blocks them silently);
4. a real public IPv4 address: no CGNAT, no double NAT (own router behind the provider box);
5. a host that is on and awake while the user is out.

UPnP covers 1 and 2 (the rule always targets the current local IP and is recreated), detects 4, and the keep-awake
setting covers 5. Task 10's installer covers 3.

## Decisions

From the discussion (2026-11-08):

- The app may create the router rule itself (UPnP, then NAT-PMP). It replaces "user-configured port forwarding" in the
  product docs; manual forwarding stays the fallback.
- An **external** port 443 forwarded to a listening port of 1024 or above is allowed. The listening-port rule
  (1024-65535, never 80 or 443) is unchanged.
- Only the HTTPS port is ever exposed to the internet; the flow never maps the HTTP port.
- Self-signed certificates and a local certificate authority are rejected for internet access.
- Manual PEM import stays as an advanced setting.
- Option B (dynamic DNS name, stable address) is deferred, "maybe later". It moves up if router tests show that UPnP
  often refuses port 443.

Answers of 2026-11-08 (planning):

1. Branch `task-09-5-internet-access-https`, one commit per step, pull request at the end.
2. **Live, no restart**: the setup starts or reloads the HTTPS listener on the spot. Renewals swap the certificate
   live. (The other HTTP and HTTPS settings keep their restart rule.)
3. **Public IP without UPnP**: one request to a public "what is my IP" service (no account). The service sees the
   home's IP address only.
4. **Keep awake** is included, off by default.

## Rules

Access and consent
- Admin only, like the other server settings. Owners and Guests get `403`.
- The setup states, next to the button, that it uses Let's Encrypt and that continuing accepts the Let's Encrypt
  Subscriber Agreement (link). No e-mail address is asked (Let's Encrypt no longer sends expiry e-mails).

Set up
1. **Find the router**: UPnP IGD first, then NAT-PMP, a few seconds each.
2. **Classify the connection** from the router's external address: public; **CGNAT** (`100.64.0.0/10`); **double
   NAT** (a private address: `10/8`, `172.16/12`, `192.168/16`). CGNAT and double NAT stop the setup with a plain
   explanation and what to ask the internet provider (for example "full IPv4 address") or check on the own router.
   Without UPnP/NAT-PMP, the public address comes from the public service and the manual screen is shown.
3. **Open the port**: a TCP rule external `443` → host local IP : HTTPS port, labelled "Media Collection". A refusal
   (port taken, ports under 1024 not allowed, shared IPv4 port range) shows the manual screen.
4. **Manual screen**: the exact values to enter in the router (host local IP, internal port, external port 443, TCP),
   links to the main French provider boxes' help, and **Check again**, which runs the certificate step.
5. **Start HTTPS live** if it is not running: with the saved HTTPS port (enabled, with a temporary self-signed
   certificate only used until the first certificate arrives; browsers never receive it from the internet because
   the address is shown only after issuance).
6. **Get the certificate**: Let's Encrypt ACME, `shortlived` profile (about 6 days), identifier = public IPv4,
   TLS-ALPN-01 answered by the app's own HTTPS listener. A failed validation means "not reachable from the internet on
   port 443": the panel says so and offers the manual screen.
7. **Activate**: the certificate is saved like a manual one (protected `tls/` folder) and swapped into the running
   listener. The panel shows `https://<public IP>` and a QR code.

Upkeep (runs at startup, then every hour, and after a failure with growing delays up to 6 hours)
- Recreate the router rule (it follows a new local IP and survives router restarts).
- Read the public address; when it changed, get a new certificate for the new address and show the new address
  ("Your internet address changed: scan the new QR code").
- Renew when less than half of the certificate's lifetime remains.
- Failures keep the current certificate while it is valid; the panel shows the last error and when the next attempt
  runs. Let's Encrypt rate limits are respected (no retry loop faster than the backoff).

Turn off
- Removes the router rule, stops renewals, keeps HTTPS running with the last certificate on the home network until
  restart (no surprise disconnection); the automatic certificate is no longer renewed.

Manual certificate (advanced)
- Saving a manual certificate while automatic internet access is on is refused: "Turn off internet access first".
- Setting up internet access over a saved manual certificate asks for confirmation; the automatic one replaces it.

Keep awake
- Installation-wide setting saved with the server settings, Admin only. When on, the desktop app asks Windows not to
  sleep while it runs (Electron `powerSaveBlocker`, `prevent-app-suspension`). The screen may still turn off.

Data safety (consistent with Task 9)
- Admin data reset keeps the internet access state, like the HTTP and HTTPS settings. Backup includes it with the
  certificate files. A restore on another computer is corrected by the next upkeep run (new local IP, maybe a new
  public IP and certificate).

Audit (technical audit log only, never in Activity: the Activity allowlist leaves server settings out)
- `server-settings.internet-access-set-up` and `server-settings.internet-access-turned-off` Successful/Failed,
  before/after with state, address and certificate expiry, never key material.
  `server-settings.keep-awake-changed` for the toggle. Upkeep runs are not audited (no actor); their outcome is
  visible in the panel.

## Design

Feature: `server-settings` (it owns HTTP/HTTPS configuration and the TLS store). No new feature folder.

Domain (`server-settings/domain/`)
- `InternetAccess` entity: mode (`off` / `automatic`), mapping (`upnp` / `nat-pmp` / `manual`), public address,
  certificate (issued at, expires at), last failure (reason, at), next attempt. Invariants: automatic mode needs a
  public address before it can hold a certificate; a certificate belongs to one address.
- `ConnectionClass` value object: classifies an IPv4 address (public, CGNAT, private).
- `RenewalPolicy` domain service: renewal due (less than half the lifetime left), address changed, backoff schedule.
- Failure reasons: `no-router`, `cgnat`, `double-nat`, `port-refused`, `not-reachable`, `public-address-unknown`,
  `rate-limited`, `authority-unavailable`, `manual-certificate-in-use`.

Application ports
- Driving: `SetUpInternetAccessUseCase`, `TurnOffInternetAccessUseCase`, `ReadInternetAccessUseCase`,
  `MaintainInternetAccessUseCase` (upkeep), `SaveKeepAwakeUseCase`.
- Driven: `RouterGateway` (find, external address, open rule, close rule), `PublicAddressProbe`,
  `CertificateAuthority` (issue for an address), `InternetAccessStore` (reader/writer), `HttpsRuntime` (start or
  reload the listener with certificate material), `KeepAwakeStore`, `KeepAwakeRuntime`, `Clock`, `LocalAddress`.
  The existing `TlsStore` gains a source (`manual` / `automatic`).

Driven adapters
- `NatApiRouterGateway` (`@xmcl/nat-api`, UPnP + NAT-PMP), `HttpPublicAddressProbe` (ipify, plain HTTPS, short
  timeout), `AcmeCertificateAuthority` (`acme-client`, Let's Encrypt production; staging for manual testing),
  `TlsAlpnChallenges` (the challenge certificates the HTTPS listener serves), `KyselyInternetAccessStore`
  (`server_settings` key `internet-access`), `NodeHttpsRuntime`.
- HTTPS listener (`bootstrap.ts`, root composition): created from `NodeHttpsRuntime`; `setSecureContext` for live
  swaps; an `SNICallback` that serves the TLS-ALPN-01 certificate when the server name is the reverse-DNS form of the
  IP (`*.in-addr.arpa`, RFC 8738) and `acme-tls/1` is negotiated; every other handshake gets the normal certificate.
- Upkeep timer in root composition, calling `MaintainInternetAccess`; stopped on shutdown.
- Keep awake: the worker sends `keep-awake` messages (startup and change) to the Electron main process, which owns
  `powerSaveBlocker`. Host runtime, not business IPC, like maintenance.

HTTP (`/api/server-settings`, Admin)
- `GET /internet-access` → state, steps, address, certificate expiry, last failure, manual values (local IP, internal
  port, external port, protocol). Polled by the page with `X-App-Activity: passive`.
- `POST /internet-access` (`{ acceptTerms: true, replaceManualCertificate?: true }`) → starts the setup, returns the
  in-progress state (`202`). One setup at a time (`409` otherwise).
- `POST /internet-access/check` → reruns the certificate step after a manual rule.
- `DELETE /internet-access` → turns it off.
- `PUT /keep-awake` (`{ enabled }`).
- `ServerStatus` gains `internetAccess` and `keepAwake`; the TLS configuration gains `source`.

Libris (Administration → Server settings)
- New top panel **Internet access**: one line on what it does, the Let's Encrypt sentence, **Set up internet access**.
  During setup: the steps with their state (Finding the router, Opening the port, Getting the certificate). Success:
  address, QR code, certificate valid until, **Turn off**. Failures: plain message per reason, next action (manual
  screen, Check again, what to ask the provider).
- **Keep this computer awake** switch next to it.
- The existing HTTP and HTTPS panels move under a collapsed **Advanced** section; the HTTPS panel says when the
  certificate is automatic.
- QR code drawn in the browser (`qrcode` library, SVG). Credits for Task 10.

## Steps

Each step: tests, `npm run check`, architecture review skill on the changes, commit, tick below.

Steps 2 and 11 are manual tests with the user. Work pauses there with a short checklist of what to do on the router
and phone and what to report back; the next step starts from the results.

- [x] **1. Documentation**: product scope, release expectations (automatic router rule, external 443, HTTPS only on
  the internet), configuration (automatic certificate storage), architecture (certificate issuance, live HTTPS
  reload, upkeep timer). Record the decisions.
- [x] **2. Library check (spike, no production code kept)**: `acme-client` with an `ip` identifier, the
  `shortlived` profile and TLS-ALPN-01 against Let's Encrypt **staging** (manual run with port 443 forwarded on the
  user's router); the UPnP/NAT-PMP library (`@silentbot1/nat-api` or another maintained fork) against the user's
  router: discover, external address, map 443, unmap. Outcome written here; if a library lacks a feature, propose the
  alternative before Step 3.

  **Outcome (2026-11-08, user's Freebox, public IPv4 `82.66.x.x`, Windows network profile Private):**
  - `@xmcl/nat-api` 0.4.5 chosen (TypeScript, UPnP + NAT-PMP, updated 2026-08) over `@silentbot1/nat-api` (low
    activity). UPnP gateway found at once; external address read; existing third-party rules listed.
  - The Freebox **accepted a UPnP rule on external 443** (→ 34443) and removed it on request.
  - `acme-client` 5.4.0 works unchanged: `createOrder` passes `{ type: 'ip' }` identifiers and `profile: 'shortlived'`
    through; `createAlpnCertificate` and `createCsr({ altNames: [ip] })` put the IP in the SAN (no common name).
  - Let's Encrypt **staging** offered `tls-alpn-01` and `http-01`; validation came from several vantage points with SNI
    `204.118.66.82.in-addr.arpa` and ALPN `acme-tls/1` (RFC 8738 confirmed), valid in 6 s; certificate issued 13 s
    after the order, SAN `IP Address:82.66.118.204`, valid 160 hours.
  - Node's `ALPNCallback` is enough to answer `acme-tls/1`; the challenge certificate can be chosen by the reverse-DNS
    server name in `SNICallback`.
  - Allowing Node on **private** networks in the Windows Firewall prompt was enough (the home network is Private).
- [x] **3. Domain**: `InternetAccess`, `ConnectionClass`, `RenewalPolicy`, failure reasons; unit tests.
- [x] **4. Application**: ports, the five use cases with in-memory doubles; audit; unit tests for every rule above
  (classification stops, refused port, unreachable, address change, renewal timing, backoff, manual certificate
  conflicts, turn off).
- [x] **5. Persistence and TLS store**: `internet-access` and `keep-awake` settings; `SaveTlsSettings` refuses any
  change while internet access is not off (`internet-access-on`); backup/reset tests extended (kept by reset, in
  backups). Decided in Step 4: no TLS `source` field; a certificate is automatic while internet access holds one, so
  the TLS contract stays unchanged and the setup asks to confirm replacing any other saved certificate. Backups copy
  the whole database, so both settings are in them without a new backup test.
- [ ] **6. HTTPS runtime**: live start and certificate swap, TLS-ALPN-01 responder through `SNICallback`, upkeep timer;
  tests with a local TLS client (normal handshake, `acme-tls/1` handshake on a reverse-DNS name, swap without dropping
  the listener).
- [ ] **7. Third-party adapters**: router gateway, public address probe, ACME authority; contract tests against local
  stand-ins (a fake UPnP/NAT-PMP responder or library-level double, Pebble is not used on Windows CI).
- [ ] **8. HTTP API**: endpoints, contracts, Zod schemas; API end-to-end tests with stand-in router/authority through
  `RuntimeOptions` (like `lookupAddresses`): roles, setup success, each failure reason, check again, turn off, keep
  awake, manual certificate conflicts, audit records.
- [ ] **9. Libris UI**: Internet access panel, QR code, manual screen, keep-awake switch, Advanced section; EN/FR;
  component tests and Playwright (desktop viewports) with the stand-ins.
- [ ] **10. Desktop keep awake**: worker message and `powerSaveBlocker` in the main process; desktop e2e check.
- [ ] **11. Real-world check (with the user)**: on the user's router and phone (mobile data, not Wi-Fi): setup,
  QR code, Leaf scanning over HTTPS, turn off. Results and router behaviour noted here.
- [ ] **12. Wrap-up**: implementation plan status, credits list for Task 10 (ACME client, NAT library, QR code
  library), push, pull request.

## Known limits

- **Changing public IP**: many providers change it on router restart. The phone's bookmark then breaks; the app
  shows the new address on the desktop, but the user may learn it at the shop. Option B fixes this.
- **External ports below 1024**: many routers refuse UPnP rules under 1024 (the default miniupnpd configuration only
  allows 1024-65535), and port 443 can be taken by the router's own remote administration. Then the manual screen is
  needed, or option B.
- **Shared IPv4** (Free on some offers, as far as known): the customer only gets a port range, which may not include
  443; a full IPv4 address can be requested in the subscriber area. To verify in Step 11 if possible.
- **CGNAT**: no port forwarding is possible at all; only a tunnel (option C) would work.
- **Windows Firewall** until Task 10: the first HTTPS start shows the Windows prompt; the panel reminds the user to
  allow both private and public networks.

## Deferred options

- **B. Stable address (maybe later)**: a free dynamic DNS name (DuckDNS, dynv6, deSEC). The user signs up once and
  pastes the name and a token; the app keeps the name on the current public IP and gets the certificate with DNS-01, on
  any external port. Stable, readable address; needs a third-party account.
- **C. Tunnel services** (Tailscale Funnel, Cloudflare Tunnel): no port forwarding, works behind CGNAT, but third-party
  software, account and traffic. At most a CGNAT fallback.
- **D. A name service run by Media Collection** (Plex-style `*.plex.direct`): the only fully zero-knowledge option, but
  it means operating a server, which the product has avoided so far. Product decision, not a feature.

## Open questions

- Which French provider boxes accept a UPnP rule on external 443 (Livebox, Freebox, SFR Box, Bbox)? Answered as far
  as possible in Step 11; the manual screen covers the rest.

## Sources

- [Let's Encrypt: 6-day and IP address certificates generally available](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability.html) (2026-01-15)
- [Help Net Security: Let's Encrypt rolls out 6-day and IP-based certificates](https://www.helpnetsecurity.com/2026/01/20/lets-encrypt-6-day-tls-certificates/)
- RFC 8738 (ACME IP identifiers): TLS-ALPN-01 uses the reverse-DNS name of the IP; DNS-01 is not allowed for IPs.
- [acme-client versions](https://socket.dev/npm/package/acme-client/versions) (TLS-ALPN-01 since 5.3.0)
- [@xmcl/nat-api](https://npmjs.com/package/@xmcl/nat-api) (UPnP and NAT-PMP, chosen in Step 2)
