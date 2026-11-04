# Media Collection

Media Collection manages a shared household book library. Its desktop web interface is **Libris** (Electron window and
desktop browsers, at `/`) and its mobile web interface is **Leaf** (phones, at `/leaf/`); both are served by the same
installation on one port. Product documentation starts at [README-media-collection.md](README-media-collection.md).

It is built on an Electron application with React, an internal NestJS backend, and SQLite through Kysely. HTTP is
available immediately on all network interfaces, including for first-time setup. HTTPS is optional and keeps HTTP
available.

The development toolchain is Node 24 LTS, TypeScript 7, Vite, Vitest, Oxlint and Oxfmt. Installed applications use
Electron's bundled runtime.

## Start developing

Install Node 24 LTS, then run from this directory:

```sh
npm ci
npm run dev
```

On Windows PowerShell, use `npm.cmd` if execution policy prevents `npm.ps1` from running. `npm ci` downloads Electron
through the root postinstall script. SQLite 13 uses Node-API; no Electron rebuild is required.

Development opens Electron with Vite at `http://127.0.0.1:5173` (Leaf at `http://127.0.0.1:5173/leaf/`). Startup also builds the web assets so remote browsers
can use `http://<computer-address>:<HTTP-port>` immediately (default `34345`). Vite proxies `/api` to the actual backend
port reported by Electron, including after restarts. React changes use HMR in Electron; remote browsers use the startup
build until it is rebuilt. Successful backend/desktop compilation restarts Electron. Development data lives in
`.dev-data/`, separately from installed application data.

To run the compiled application:

```sh
npm run build
npm start
```

On first launch, Libris asks you to create the protected administrator (username and password of your choice). This
is only possible on the computer running Media Collection. The administrator then creates Owner and Guest accounts
with temporary passwords, which each person replaces at first sign-in. There is no public registration or
browser-based administrator recovery. The interface follows the device language (French or English) until each user
chooses their own language.

## HTTP, internet access and HTTPS

HTTP listens on **0.0.0.0:34345** by default. Local, LAN and remote browsers use the same application and API. Server
settings show local/LAN addresses and the active and saved HTTP ports. An administrator can change the **HTTP / web
interface** port in Server settings. Both HTTP and HTTPS ports must be integers from **1024 through 65535**, inclusive.
Saving keeps the current listener active; close and reopen the desktop application to apply the new port. For example,
save `36000`, restart the application, and open `http://<computer-address>:36000` in an external browser.

To allow internet access, permit the chosen TCP port in the computer's firewall and forward
the router's public TCP port to this computer's LAN address and HTTP port. Clients use
`http://<public-address>:<forwarded-port>`. Router forwarding also requires a reachable public address; connections
behind carrier NAT need a public address or a suitable tunnel. The app performs no router configuration.

HTTP works without installing or accepting a certificate. Plain HTTP does not encrypt passwords or data in transit.
HTTPS is available when a trusted certificate is appropriate for the deployment; it never redirects HTTP or enables
HSTS.

In **Server settings**, supply a currently valid PEM certificate chain and matching unencrypted private key, choose a
port (default **3443**), and enable HTTPS. Restart Electron to apply the saved settings. Both protocols share the
database. If optional HTTPS cannot start, HTTP continues and the administrator sees the error. Private keys are never
returned by the API.

For HTTP, precedence is CLI option, environment variable, saved setting, then default `34345`. Overrides do not replace
the saved value. Server settings show an active override; remove it and restart to apply a different saved port.

| CLI option               | Environment variable | Default                                                             |
| ------------------------ | -------------------- | ------------------------------------------------------------------- |
| `--host <address>`       | `APP_HOST`           | `0.0.0.0`                                                           |
| `--http-port <port>`     | `APP_HTTP_PORT`      | Saved HTTP port, otherwise `34345`                                  |
| `--data-dir <directory>` | `APP_DATA_DIR`       | Development `.dev-data`; installed Electron per-user data directory |

CLI and environment port values must also be in `1024`–`65535`; port `0` is reserved for internal test fixtures.
For example: `npm start -- --http-port 4000 --data-dir ./local-data`. If a saved port is occupied, startup offers
Retry/Quit and reports the port. Launch once with a valid `--http-port` override, correct the saved port in Server
settings, then close and reopen without that override. Existing HTTPS settings below `1024` remain visible for
correction
and produce an HTTPS startup error while HTTP remains available.

Keep custom data directories private. Back up the entire data directory with the application closed, including
`application.sqlite`, `session.key` and `tls/`. The Electron browser profile lives below `electron-profile/`. Do not
commit storage or keys.

## Local administrator recovery

Close the normal application first. Run the application executable with:

```sh
<app> --reset-admin --login <administrator-login> [--data-dir <directory>]
```

For a development checkout:

```sh
npm run build
npm run reset-admin -- --login admin
```

For Windows, for example: `"Media Collection.exe" --reset-admin --login admin`. If you changed the login or data directory,
supply those values. The local dialog asks for a new temporary password. Recovery requires an existing database and
administrator account, starts no HTTP/HTTPS listeners, invalidates previous sessions, and requires replacement of the
temporary password at the next login. The normal and recovery processes cannot open the same application profile
concurrently.

## Checks and packaging

```sh
npm run check
npm run package:dir
npm run test:packaged
npm run package
```

`check` builds, then runs no-emit TypeScript checks, lint, format checks, architecture fixtures, focused unit tests,
React component tests (jsdom), real SQLite tests, controller HTTP tests through Nest TestingModule, browser end-to-end
tests of Libris and Leaf in real Chromium (Playwright), and Electron lifecycle/desktop tests. Electron tests require a
graphical session. Install the test browser once with `npx playwright install chromium`; set `MC_SCREENSHOT_DIR` to a
folder to keep screenshots of the browser tests for visual review. Controller API tests use isolated application fixtures and an injected clock; no test
endpoints or clock controls exist in the production app.

Controller tests are colocated as `<name>.controller.e2e-spec.ts`; unit tests use matching sibling `.spec.ts` files.
`test:api` discovers these controller suites and the retained runtime API scenarios; `test:unit` covers server core,
desktop configuration, and browser helpers. The server's discoverable editor configuration is
`apps/server/tsconfig.json`; explicit builds retain `tsconfig.runtime.json` and exclude test/support files. See
`tests/api/setup/test-app.ts` and `tests/api/fixtures` for the shared API fixture pattern.

Useful focused commands: `test:architecture`, `test:unit`, `test:api`, `lint`, `lint:fix`, `format` and `format:check`.
`package:dir` creates an unpacked app under `release/`; `test:packaged` starts it outside the checkout, verifies
HTTP/web assets (Libris and Leaf)/native SQLite, closes the window, restarts, and checks a persisted account
preference. Set `APP_PACKAGED_EXECUTABLE` to
test a different executable. `package` produces unsigned NSIS, DMG or AppImage output on its respective platform. No
separate Node/npm installation is needed by the installed app. Verification and packaging run locally; the project
includes no continuous-integration pipeline.

Oxlint runs selected `@stylistic/eslint-plugin` rules to require braces, multiline block bodies, one instruction per
line, and blank lines around control statements and before returns. Consecutive declarations stay grouped; test files
may preserve blank lines between declarations for Arrange, Act, and Assert. `npm run lint:fix` applies safe lint fixes
and then runs Oxfmt.

See [architecture](docs/architecture.md) and [agent guidance](AGENTS.md), the single source of truth for agents.
Claude agents are redirected there by [.claude/CLAUDE.md](.claude/CLAUDE.md). The backend and lint checks follow the
Screaming/Hexagonal driving/driven/config layout with mandatory SOLID principles.
The [architecture migration record](docs/architecture-migration-plan.md) describes the changes and verification. The
repository [architecture review skill](.agents/skills/architecture-review/SKILL.md)
checks manual additions and must be used before agents finish code changes.
