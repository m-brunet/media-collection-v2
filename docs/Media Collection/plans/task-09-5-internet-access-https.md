# Task 9.5 — Internet access and HTTPS setup

Status: not planned (brief recorded 2026-11-08, from a discussion with the user). A detailed plan is written and
approved before implementation, as for every task.

Owning docs: [product scope](../product/product-scope.md) (internet access, port constraints),
[release expectations](../operations/release-expectations.md) (connectivity, transport),
[configuration](../operations/configuration.md) (TLS key storage), [architecture](../architecture/architecture.md)
(storage, identity and transport: "No certificate issuance" changes with this task).

## Goal

Leaf is used while out shopping, so the installation must be reachable from the internet over HTTPS. Today the
Admin pastes a PEM certificate and private key in the settings, and sets up port forwarding on the router alone. Both
need technical knowledge. The goal is one action, **Set up internet access**, that needs no knowledge from the user:
it opens the router port, gets a trusted certificate, renews it, and gives the phone its address.

## Why a certbot-style button is not enough on its own

Let's Encrypt needs a public name (a domain, or since 2026-01-15 a public IP address) and a proof of control:

- HTTP-01 on external port 80, or TLS-ALPN-01 on external port 443, checked from the internet;
- or DNS-01, a TXT record created through a DNS provider's API (domain names only, not IP addresses).

A household has no domain. Its public IP address is usable, but only with the port 443 proof. The app keeps listening
on a port from 1024 to 65535: the router forwards **external** port 443 to it (for example 443 → 34346), so one
forwarding rule is still enough.

Port forwarding is the harder step for users. A working forward needs:

1. a router rule from the external port to the host's local IP and the app's HTTPS port;
2. a host local IP that does not change (DHCP can reassign it);
3. Windows Firewall allowing incoming connections to the app (a "public" network profile blocks them silently);
4. a real public IPv4 address: no CGNAT, no double NAT (own router behind the provider box);
5. a host that is on and awake while the user is out.

## Proposed flow

One button in the server settings, Admin only:

1. **Find the router** with UPnP IGD, then NAT-PMP/PCP.
2. **Read the external IP** from the router and classify the connection: public, CGNAT (`100.64.0.0/10`) or double NAT
   (private address). CGNAT and double NAT end the flow with a plain explanation.
3. **Ask for the forwarding rule** external TCP 443 → host local IP : HTTPS port. If the router refuses or has no
   UPnP, show a guided manual screen with the exact values to enter (local IP, internal port, external port, TCP) and
   links for the main French provider boxes.
4. **Get a Let's Encrypt IP address certificate** (short-lived profile, about 6 days) with TLS-ALPN-01 answered by the
   app's own HTTPS listener. A failed validation doubles as the reachability test ("port not reachable from the
   internet").
5. **Keep it working**: recreate the rule at startup and refresh it periodically (it follows a new local IP), renew the
   certificate every few days, remove the rule when internet access is turned off.
6. **Show a QR code** with the `https://` address to scan on the phone.

Alongside:

- Only the HTTPS port is ever exposed to the internet, never plain HTTP. The flow enforces it.
- Task 10 builds the Windows installer with an incoming firewall rule for the app.
- Optional setting "Keep this computer awake while Media Collection runs" (Electron power save blocker).
- Manual PEM certificate and key import stays, moved to an advanced section, for users with their own domain or
  reverse proxy.

## Known limits

- **Changing public IP**: many providers change it on router restart. The phone's bookmark then breaks, and the user
  learns it at the shop. Option B below fixes this.
- **External ports below 1024**: many routers refuse UPnP rules under 1024 (the default miniupnpd configuration only
  allows 1024-65535), and port 443 can be taken by the router's own remote administration. Then the manual screen is
  needed, or option B.
- **Shared IPv4** (Free on some offers, as far as known): the customer only gets a port range, which may not include
  443; a full IPv4 address can be requested in the subscriber area. To verify.
- **CGNAT**: no port forwarding is possible at all; only a tunnel (option C) would work.

## Deferred options

- **B. Stable address (maybe later)**: a free dynamic DNS name (DuckDNS, dynv6, deSEC). The user signs up once and
  pastes the name and a token; the app keeps the name on the current public IP and gets the certificate with DNS-01, on
  any external port. Stable, readable address; needs a third-party account. If router tests show that UPnP often
  refuses port 443, this moves up.
- **C. Tunnel services** (Tailscale Funnel, Cloudflare Tunnel): no port forwarding, works behind CGNAT, but third-party
  software, account and traffic. At most a CGNAT fallback.
- **D. A name service run by Media Collection** (Plex-style `*.plex.direct`): the only fully zero-knowledge option, but
  it means operating a server, which the product has avoided so far. Product decision, not a feature.

## Rejected

- Self-signed certificate or a local certificate authority installed on each device: fine for a home network, but on
  the internet it trains users to click through certificate warnings.

## Open questions for planning

- Product docs say "user-configured port forwarding" and "ports 80 and 443 are not permitted" (listening port). Confirm
  that the app may create the router rule itself, and that an **external** port 443 forwarded to a listening port of
  1024 or above is allowed; then update [product scope](../product/product-scope.md) and
  [release expectations](../operations/release-expectations.md).
- Check that the chosen Node ACME library supports TLS-ALPN-01 and IP identifiers with the short-lived profile, and
  that the UPnP/NAT-PMP library (for example `nat-api`) is maintained.
- Test UPnP on Livebox, Freebox, SFR Box and Bbox: enabled by default? accepts external 443?
- Where the Let's Encrypt account key and issued certificate live (same protected storage as the current TLS files).
- How the app reports state: reachable, certificate expiry, last renewal, last error.

## Sources

- [Let's Encrypt: 6-day and IP address certificates generally available](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability.html) (2026-01-15)
- [Help Net Security: Let's Encrypt rolls out 6-day and IP-based certificates](https://www.helpnetsecurity.com/2026/01/20/lets-encrypt-6-day-tls-certificates/)
