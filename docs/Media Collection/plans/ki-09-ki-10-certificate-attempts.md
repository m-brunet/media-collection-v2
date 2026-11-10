# KI-9 and KI-10 — Let's Encrypt attempts

Status: **plan approved by the user** (2026-11-10, both proposals below accepted); commit 1 (KI-10) done. Branch
`fix/ki-9-ki-10-certificate-attempts`, one pull request, two commits: KI-10 first, then KI-9.

Known issues: [KI-9](known-issues.md#ki-9--internet-access-no-automatic-lets-encrypt-retries-estimated-attempts-left)
and [KI-10](known-issues.md#ki-10--internet-access-renew-certificates-through-ari-so-renewals-escape-lets-encrypt-limits).
Owning docs: [Task 9.5](task-09-5-internet-access-https.md), [Task 9.6](task-09-6-internet-access-domain-name.md),
`operations/configuration.md`. Feature: `apps/server/src/server-settings`; Libris panel
`apps/web/src/libris/administration/internet-access-panel.tsx`.

## Commit 1 — KI-10: renewals through ARI

A renewal of the same name sends `replaces: <certificate identifier>` in the new order, so Let's Encrypt does not
count it toward any rate limit.

- **Port:** `CertificateAuthority.issue(subject, replacing)` where `replacing` is the current certificate chain (PEM)
  when it covers the same name, else `null`. `InternetAccessSetup.renew` passes it: the current certificate's
  `address` equals the certificate name. A first setup, a new address or a domain name change sends `null`.
- **Where the chain comes from:** a new `TlsCertificateReader` driven port (`current(): Promise<string | null>`, the
  saved chain), implemented by `FileTlsStore`, which already keeps it. Key material stays out of the domain; the
  chain only travels from the store to the ACME adapter.
- **Certificate identifier:** `AriCertificateId.of(chainPem)` (infrastructure, `ari-certificate-id.adapter.ts`): base64url of the leaf's
  Authority Key Identifier, `.`, base64url of the serial number as encoded in the certificate (the DER integer
  bytes, a leading zero byte included), per RFC 9773. Read with `@peculiar/x509`, added as a direct dependency at the version `acme-client`
  already brings (1.14.3).
- **Fallback:** if the order with `replaces` is refused for any reason other than a rate limit (certificate already
  replaced, unknown, field not accepted), the adapter orders once more without it. A rate-limit refusal is returned
  as such.
- **Outcome:** `issued` gains `renewal: boolean`, true when the order with `replaces` was accepted; commit 2 uses it
  (an ARI renewal does not count in the estimate).
- **Not done:** the ARI renewal window (`renewalInfo`): renewals stay at half-life (address) and two thirds (domain
  name). Optional in KI-10; can follow later.
- **Tests:** `AriCertificateId` on a fixture certificate (identifier computed independently in the test from the
  fixture's known AKI and serial); the adapter with a fake ACME session: `replaces` present for a renewal, absent for
  a new name, the fallback order without it, a rate limit not retried; `InternetAccessSetup.renew` passes the chain
  only for the same name.
- **Staging check:** not possible from the development computer (Let's Encrypt must reach port 443 from the
  internet). The fallback keeps a wrong `replaces` harmless (one extra normal order). The first real renewal after
  install is the check: the server log says whether the order went through ARI.

## Commit 2 — KI-9: no attempts that cannot succeed, estimated attempts left

### State (saved with the internet access setting, no migration: JSON with defaults)

- `retryAfter: string | null`: Let's Encrypt's date after a rate-limit refusal. Kept through Turn off and a new
  setup; cleared once passed.
- `history: { name, at, kind: 'certificate' | 'failed-check' }[]`: certificates issued (not ARI renewals) and failed
  checks, per address or domain name, last 8 days only. Kept through Turn off.
- `checkNeeded` is not a new field: in the `active` phase, a `not-reachable` failure means the upkeep waits for the
  Admin.

### Rules (domain)

- **`AttemptAllowance`** (domain service, pure): from the history of one name and `now`, the two Let's Encrypt
  buckets: certificates (5, one back every 34 hours) and failed checks (5, one back every 12 minutes), starting full.
  Gives the estimated count left and, at zero, when the next one comes back.
- **After a rate-limit refusal:** nothing goes to Let's Encrypt before `retryAfter`: the upkeep skips the certificate
  work, Set up and Check again are refused (409, `rate-limited`, with the date). Date read from the refusal message
  ("retry after 2026-11-12 23:30:00 UTC"); without one, 6 hours (today's longest wait).
- **After a failed check (`not-reachable`) while active:** the upkeep stops trying the certificate (the router rule is
  still kept every hour, KI-13) and the panel offers **Check again**, which tries once, keeping the current
  certificate. While setting up, a failed check already waits for Check again (`waiting-for-port`).
- **Failures that cost nothing** (Let's Encrypt or the router unreachable, HTTPS not starting, domain name not
  pointing home): unchanged growing delays (1 hour, doubling, up to 6 hours).
- The 1,152 consecutive failed checks limit is not estimated: with no automatic retry of failed checks it cannot be
  reached by the application.

### Libris panel (EN/FR)

- After a failure, under the message: "About N certificates left this week for this address." and "About N checks
  left this hour." with "This is an estimate: other software using the same address also counts."
- Rate limited: "Let's Encrypt accepts a new attempt after {date}." The button is disabled until then.
- An estimate at zero: the button stays usable (it is only an estimate) but says when an attempt becomes likely to
  work: "Probably refused until {date}".
- Active with a failed check: the warning, the router rule to check (as on the manual page when the mapping is
  manual), and **Check again**.
- **Turn off** confirmation adds: "Setting it up again uses one of the 5 certificates Let's Encrypt allows per week
  for this address."

### API

- `InternetAccessStatus` gains `retryAfter` and `allowance: { certificates: { left, nextAt }, checks: { left, nextAt } } | null`
  (null before any failure). The history itself is not sent.
- `POST /internet-access/check` accepts the active phase after a failed check.

### Tests

- `AttemptAllowance`: full with no history, one used, refill over time, zero with the next date, other names ignored,
  entries older than 8 days ignored.
- `InternetAccess` entity: rate limit keeps `retryAfter` through turn off and start; history recorded and pruned;
  check allowed when active after `not-reachable`; refused before `retryAfter`.
- `MaintainInternetAccess`: no authority call before `retryAfter`, none after a failed check, growing delays kept for
  `authority-unavailable` and domain problems, the router rule still kept in every case.
- `CheckInternetAccess` / `SetUpInternetAccess`: refused before `retryAfter`; check while active keeps the certificate
  on failure and replaces it on success.
- ACME adapter: the date parsed from a rate-limit message; the 6-hour fallback.
- Controller API tests: 409 before `retryAfter`, check while active; panel component tests for the new texts (EN/FR).
- No test reaches Let's Encrypt (Task 9.6 rule).

## Questions for the user (answered 2026-11-10: both proposals accepted)

1. **Check again while active:** KI-9 says the upkeep waits for the Admin's Check again after a failed check; today
   that button only exists during setup. Proposed: show it on the active panel too. OK?
2. **At zero by the estimate:** proposed: the button stays usable with "Probably refused until {date}", since the
   estimate can be wrong; only Let's Encrypt's own date disables it. Or disable it at zero too?
