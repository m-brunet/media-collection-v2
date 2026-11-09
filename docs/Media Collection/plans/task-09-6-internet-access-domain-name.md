# Task 9.6 — Domain name and HTTP internet access

Status: in progress (2026-11-09). Branch `task-09-6-internet-access-domain-name` from `master`, one commit per step,
pull request at the end. Global plan: [implementation plan](implementation-plan.md). Follows
[Task 9.5](task-09-5-internet-access-https.md).

Owning docs: [product scope](../product/product-scope.md), [release expectations](../operations/release-expectations.md),
[architecture](../architecture/architecture.md).

## Goal

With Task 9.5, the phone's address is the home's public IP address, and only HTTPS can be opened to the internet. Two
needs came out of the first real test:

1. An Admin who owns a domain name, kept on the home connection by the router's dynamic DNS (for example a Freebox with
   an OVH domain), wants every internet address to use it, so bookmarks and QR codes survive IP changes.
2. When HTTPS cannot be set up (or until it is), Libris and Leaf must still be reachable from outside over HTTP. Like
   Foundry VTT, the Admin chooses it knowing it is not encrypted.

## Scope

In:

- **Domain name** setting, saved on its own (top of the Internet access panel). Saving checks the format, then that
  the name points to this connection's public address; otherwise the name is refused and nothing changes.
- **HTTP from the internet**: one action opens a router rule external HTTP port → this computer's HTTP port (UPnP,
  manual values otherwise), with a clear "not encrypted" warning; one action closes it.
- **HTTPS from the internet**: Task 9.5's setup, now using the saved domain name: certificate for the name (`dns`
  identifier, `classic` profile, renewed at two thirds of its lifetime), proven with TLS-ALPN-01 on external 443.
- When an HTTPS setup succeeds, HTTP from the internet closes; while HTTPS is on, HTTP cannot be opened.
- Internet addresses (`http://<name>:<http port>`, `https://<name>`, with the public IP when there is no name) in the
  Internet access panel and in the addresses panel with their QR codes.
- Hourly upkeep for both router rules; domain name checks; EN/FR; tests at every level; documentation.

Out: DNS-01 and DNS provider APIs, editing DNS records, several names per installation, other applications sharing the
name, IPv6, HTTP-01, HTTP→HTTPS redirects, an external HTTP port different from the HTTP port.

## Decisions (2026-11-09)

- "Just a domain name": no DNS provider account or API token; the router (or the Admin) keeps the name on the public IP.
- The domain name is its own setting, saved and checked on its own, used by HTTP and HTTPS addresses alike.
- Saving refuses a name that does not point to this connection (or when the public address cannot be found), so the
  addresses never switch to a name that does not work.
- **HTTP may be opened to the internet** at the Admin's explicit request, with a warning. This reverses Task 9.5's
  "only HTTPS is exposed" rule: HTTPS stays the recommended way, HTTP is the fallback when HTTPS does not work.
- The external HTTP port is the HTTP port itself (1024-65535 already). No port 80. The rule and address follow the
  port the HTTP listener actually runs on (an `HttpListener` port), including a command-line or environment override.
- HTTPS working closes HTTP: a successful HTTPS setup removes the HTTP rule and says why; HTTP cannot be opened while
  HTTPS is on; turning HTTPS off does not reopen HTTP.
- A name means the `classic` certificate profile, renewed about every 60 days (two thirds of the lifetime). Without a
  name, Task 9.5's IP certificate is unchanged.

## Rules

Domain name
- Optional. Normalised: trimmed, lower case, one trailing dot removed. Accepted: labels of letters, digits and inner
  hyphens (1-63 characters, punycode allowed), at least two labels, 253 characters at most, a last label that is not
  only digits. Otherwise `invalid_input`, `domain-name-invalid`.
- Saving a name: the public address comes from the router (UPnP), else from the public service. Then the name's IPv4
  addresses (A records) must include it. Refusals (`invalid_input`): `domain-unresolved` (no address),
  `domain-mismatch` (points elsewhere; the message gives the public address), `public-address-unknown`.
- Saving an empty name removes it. Admin only; audited `server-settings.domain-name-changed`.
- While HTTPS is on, a changed or removed name gets a new certificate in the background (failure shown like an upkeep
  failure; the current certificate stays). Otherwise the next HTTPS upkeep or setup uses it.

HTTP from the internet
- **Open**: refused while HTTPS is on (`conflict`, `https-active`). Finds the router; CGNAT or double NAT stops with the
  same explanations as HTTPS. Opens TCP external HTTP port → local IP : HTTP port. A refusal, or no router, shows the
  manual values (public address from the public service); the access then counts as open by hand.
- **Close**: removes the router rule when the app created it.
- Saving another HTTP port is refused while HTTP from the internet is open (`internet-access-on`).
- Upkeep (same timer as HTTPS): recreate the rule, follow a new public address; failures are shown, not audited.
- Audited `server-settings.http-internet-access-opened` / `-closed`.

HTTPS from the internet (changes to Task 9.5)
- The setup uses the saved name. The certificate step checks the name (`domain-unresolved`, `domain-mismatch` stop the
  setup), then asks for a `classic` certificate for it.
- On success (setup or Check again), HTTP from the internet is closed and marked "closed because HTTPS works".
- Upkeep: a changed public address needs no new certificate with a name; the name is checked on every run (warning on
  mismatch, certificate kept, growing delays); renewal at two thirds of the lifetime for a name, half for an IP.

Addresses
- HTTP: `http://<name or public IP>:<HTTP port>` while open. HTTPS: `https://<name or public IP>` while active (the
  name the certificate covers). The Internet access panel shows the Leaf link; the QR codes are in the addresses
  panel only, with the other addresses (decided 2026-11-09, after the real test).
- Local addresses (`http://192.168.x.x:<port>`) are unchanged.

## Design

Domain (`server-settings/domain/`)
- `DomainName` value object (validation).
- `InternetAccess` (HTTPS): `domain` is the name the current setup or certificate uses; `start(domain)`,
  `useDomain(domain)` while active; `certificateName`; renewal share by kind.
- `HttpInternetAccess` entity: `off` / `open`, mapping (`upnp`, `nat-pmp`, `manual`), public address, last failure,
  `closedByHttps`. Classifies the router's external address like `InternetAccess`.

Application
- Driven ports: `DomainNameResolver`, `DomainNameReader` / `DomainNameStore`, `HttpInternetAccessReader` /
  `HttpInternetAccessStore`.
- Services: `DomainNameCheck` (name vs address), `PublicAddressLookup` (router, else public service),
  `HttpPortForwarding` (open, close, refresh the HTTP rule).
- Use cases: `SaveDomainName`, `ReadDomainName`, `OpenHttpInternetAccess`, `CloseHttpInternetAccess`,
  `ReadHttpInternetAccess`, `MaintainHttpInternetAccess`; `SetUpInternetAccess` reads the saved name;
  `InternetAccessSetup` closes HTTP on success and follows a changed name; `SaveHttpSettings` refuses a port change
  while HTTP is open.

Infrastructure
- `DnsDomainNameResolver`; ACME `dns` + `classic`; challenge server name for a domain; Kysely repositories
  (`domain-name`, `http-internet-access` settings, kept by data reset like the other host settings).
- HTTP: `PUT /api/server-settings/domain-name` (`{ domain: string | null }`), `POST` / `DELETE
  /api/server-settings/internet-access/http`. `ServerStatus` gains `domainName` and `httpInternetAccess`.
- The upkeep adapter runs the HTTPS and HTTP upkeeps in turn.

Libris (Internet access panel)
- Domain name field with **Save** and the check result.
- **HTTP from the internet**: warning, **Open** / **Close**, rule state, manual values, address and QR code; the
  "closed because HTTPS works" note.
- **HTTPS from the internet**: Task 9.5's section without the domain field.
- Addresses panel: the internet addresses after the local ones.

## Steps

Each step: tests, the relevant checks, architecture review skill on the changes, commit, tick below.

- [x] **1. Documentation and plan** (first version), then updated for the new scope.
- [x] **2. Domain** (first version): `DomainName`, `InternetAccess`, `RenewalPolicy`.
- [x] **3. Application** (first version): resolver port, `DomainNameCheck`, setup, upkeep.
- [x] **4. Infrastructure and HTTP** (first version): DNS resolver, ACME identifiers and profile, challenge name.
- [x] **5. Libris** (first version): domain field in the setup.
- [x] **6. Domain name setting**: store, save/read use cases, check on save, follow a changed name while HTTPS is on,
  endpoint, setup reads the saved name.
- [x] **7. HTTP from the internet**: entity, port forwarding service, open/close/read/maintain use cases, HTTPS
  success closes HTTP, HTTP port lock, endpoints, upkeep.
- [x] **8. Libris**: panel sections, addresses panel, EN/FR; component and browser tests.
- [ ] **9. Wrap-up**: full check, implementation plan status. Real-world check (Freebox, OVH name, phone on mobile
  data) with the user; push and pull request on the user's go-ahead.
  Done so far (2026-11-09): `npm run check` passes (317 files, 2814 tests); no test can reach the internet (see Testing
  rule). Push and pull request wait for the user's go-ahead.

## Testing rule (2026-11-09)

No test may contact Let's Encrypt, a router, the public address service or DNS (Task 9.5's Step 9 incident used the
week's Let's Encrypt limit). Unit and API tests use doubles; browser journeys use stand-ins; every Electron test launch
sets `APP_OFFLINE_INTERNET_ACCESS=1`, so the real worker uses `OfflineInternetAccess`. `tests/api/offline-internet-access.e2e-spec.ts`
proves it on the real worker: setting up HTTPS, opening HTTP and saving a domain name all stop at "public address
unknown".

## Known limits

- **HTTP is not encrypted**: passwords, the session cookie and library data can be read on the networks between the
  phone and the home. The panel says so; HTTPS closes HTTP once it works.
- **Renewal check moment**: Node chooses the certificate from the server name before it sees `acme-tls/1`. During the
  few seconds of a check (about every 60 days) a browser opening the name may get the challenge certificate and a
  warning; reloading fixes it.
- **Inside the home network**, the name resolves to the public IP; the router must send the traffic back (NAT
  loopback). Freeboxes do.
- **IPv6**: the name should only have an A record; with an AAAA record Let's Encrypt may try IPv6, where no port is open.
- **Dynamic DNS delay**: after an IP change, the upkeep warns until the name catches up.
- **Duplicate certificates**: 5 per week for the same name; renewals every 60 days are far below it.
