# Task 9.6 — Internet access with a domain name

Status: in progress (2026-11-09). Branch `task-09-6-internet-access-domain-name` from `master`, one commit per step,
pull request at the end. Global plan: [implementation plan](implementation-plan.md). Follows
[Task 9.5](task-09-5-internet-access-https.md).

Owning docs: [product scope](../product/product-scope.md), [release expectations](../operations/release-expectations.md),
[architecture](../architecture/architecture.md) (updated in Step 1).

## Goal

With Task 9.5, the phone's address is the home's public IP address. Many providers change it, and the Leaf bookmark and
QR code then break. An Admin who owns a domain name, already kept on the home connection by the router's dynamic DNS
(for example a Freebox with an OVH domain), can enter it once. The certificate then covers the name, the address and QR
code use `https://<domain>`, and nothing changes when the public IP changes.

## Scope

In:

- An optional **Domain name** field in the Internet access panel, sent with **Set up internet access**.
- A DNS check before each certificate request and on each upkeep run: the name must point to the public address.
- A Let's Encrypt certificate for the name: `dns` identifier, **`classic` profile** (90 days today), proven with
  TLS-ALPN-01 on external port 443 like the IP certificate.
- Renewal at **two thirds** of the lifetime for a name (day 60 of a 90-day certificate), unchanged (half) for an IP.
- The address, QR code and audit records use the name.
- EN/FR strings, tests at every level, documentation.

Out: DNS-01 and DNS provider APIs (OVH or others), editing DNS records, several names or subdomains per installation,
other applications sharing the name, IPv6, HTTP-01.

## Decisions (2026-11-09)

- "Just a domain name": no DNS provider account or API token. The router (or the Admin) keeps the name on the public IP.
- A name means the `classic` profile, renewed about every 60 days (two thirds of the lifetime, so it follows Let's
  Encrypt's announced shorter lifetimes without a change). Without a name, Task 9.5 is unchanged.
- The proof stays TLS-ALPN-01 on external port 443: the router rule, the manual screen and the HTTPS listener stay as
  they are.

## Rules

Domain name
- Optional. Empty means no name (Task 9.5 behaviour).
- Normalised: trimmed, lower case, one trailing dot removed. Accepted: 2 to 127 labels of letters, digits and inner
  hyphens (1-63 characters each, punycode `xn--` allowed), 253 characters at most, a last label that is not only digits
  (so an IP address is refused). A scheme, port, path, space or `*` is refused: `invalid_input`,
  reason `domain-name-invalid`.
- Entered with the setup. It is kept when the setup stops or internet access is turned off, so the field shows it again.
  To change the name while internet access is on: turn off, then set up again.

Setup (with a name)
- The router and port steps are unchanged.
- The certificate step first looks up the name's IPv4 addresses (A records):
  - no address or the lookup fails → the setup stops with `domain-unresolved`;
  - the public address is not among them → the setup stops with `domain-mismatch`.
  The panel explains what to check (the dynamic DNS settings of the router) and shows the public address.
- Then the certificate is requested for the name (`classic`), and the address shown is `https://<domain>`.

Upkeep (with a name)
- Router rule and public address as in Task 9.5. A changed public address is recorded but needs no new certificate.
- Every run checks the name: `domain-unresolved` or `domain-mismatch` is an upkeep failure (warning in the panel,
  current certificate kept, growing retry delays). The name catching up after a few minutes clears it on the next run.
- Renewal when two thirds of the lifetime has passed, or at once when the certificate does not cover the name.

Unchanged: Admin only, audit categories (the before/after states now include `domain`), turn off, manual certificate
rules, keep awake, data reset and backup.

## Design

Domain (`server-settings/domain/`)
- `DomainName` value object: `DomainName.optional(value)` normalises and validates, null for blank.
- `InternetAccess`: state gains `domain: string | null`; `start(domain)`; `stop` and `turnOff` keep the domain;
  `certificateName` (domain, else public address) is what the certificate must cover (`activate`, `renewalDue`,
  origin).
- `RenewalPolicy.renewalDue(certificate, name, share, now)` with `addressShare = 1/2` and `domainShare = 2/3`.
- `IssuedCertificateState.address` keeps its name (saved JSON and HTTP contract) and now means "the address or name it
  covers".
- Failure reasons gain `domain-unresolved` and `domain-mismatch`.

Application
- Driven port `DomainNameResolver.addresses(name): Promise<string[]>` (IPv4, empty when unknown or on failure).
- Application service `DomainNameCheck.problem(access)`: null without a name, otherwise one of the two reasons.
  `InternetAccessSetup.renew` and `MaintainInternetAccess` use it.
- `CertificateAuthority.issue(subject)` with `CertificateSubject = { kind: 'address' | 'domain'; name }`.
- `SetUpInternetAccessUseCase` input gains `domain: string | null`.

Infrastructure
- `DnsDomainNameResolver` (`node:dns/promises` `resolve4`, the system's DNS servers).
- `AcmeCertificateAuthority`: `ip` + `shortlived` or `dns` + `classic`; CSR for the name.
- `TlsAlpnChallenges`: the challenge server name is the reverse-DNS form for an address and the name itself for a
  domain.
- HTTP: `POST /api/server-settings/internet-access` accepts `domain` (string or null, 253 characters at most);
  `InternetAccessStatus` gains `domain`.
- Test stand-ins (API fixture and browser worker) gain a resolver that answers the router's external address.

Libris
- Panel, setup state: text field **Domain name (optional)** with a hint ("Only if you own a domain name that already
  points to this connection, for example through your router's dynamic DNS. Leave empty to use the internet
  address."), prefilled from the status.
- Active state: the address shows the name; the domain failures show as warnings with the public address.

## Steps

Each step: tests, the relevant checks, architecture review skill on the changes, commit, tick below.

- [x] **1. Documentation and plan**: owning docs and this plan.
- [ ] **2. Domain**: `DomainName`, `InternetAccess`, `RenewalPolicy`; unit tests.
- [ ] **3. Application**: resolver port, `DomainNameCheck`, setup, upkeep, set-up use case; unit tests.
- [ ] **4. Infrastructure and HTTP**: DNS resolver, ACME identifiers and profile, challenge name, controller,
  contracts, stand-ins; adapter and API tests.
- [ ] **5. Libris**: domain field, messages, EN/FR; component and browser tests.
- [ ] **6. Wrap-up**: full check, implementation plan status, push, pull request. The real-world check (Freebox,
  OVH name, phone on mobile data) is for the user.

## Known limits

- **Renewal check moment**: Node chooses the certificate from the server name before it sees the `acme-tls/1`
  protocol. During the few seconds of a check (about every 60 days) a browser opening the name gets the challenge
  certificate and a warning; reloading fixes it. With an IP address this never happens, because browsers do not send
  the reverse-DNS name.
- **Inside the home network**, the phone gets the public IP for the name; the router must send the traffic back to the
  computer (NAT loopback). Freeboxes do.
- **IPv6**: if the name also has an AAAA record, Let's Encrypt may try IPv6 first, and the app opens no IPv6 port. The
  dynamic DNS should publish IPv4 only.
- **Dynamic DNS delay**: after an IP change, the upkeep warns until the name catches up; the certificate stays valid.
- **Duplicate certificates**: Let's Encrypt allows 5 certificates per week for the same name; renewals every 60 days
  are far below it.
