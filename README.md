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
can use `http://<computer-address>:<HTTP-port>` immediately (development default `34346`, so it runs beside an installed
release on `34345`). Vite proxies `/api` to the actual backend
port reported by Electron, including after restarts. React changes use HMR in Electron; remote browsers use the startup
build until it is rebuilt. Successful backend/desktop compilation restarts Electron. Development data lives in
`.dev-data/`, separately from installed application data. The window title and tray icon end with "(dev)" so a running
installed release is easy to tell apart.

To run the compiled application:

```sh
npm run build
npm start
```

On first launch, Libris asks you to create the protected administrator (username and password of your choice). This
is only possible in the Media Collection desktop window, not from a browser. The administrator then creates Owner and Guest accounts
with temporary passwords, which each person replaces at first sign-in. There is no public registration or
browser-based administrator recovery. The interface follows the device language (French or English) until each user
chooses their own language.

## HTTP, internet access and HTTPS

HTTP listens on **0.0.0.0:34345** by default (**34346** when running from source). Local, LAN and remote browsers use the same application and API. Server
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

In **Server settings › Ports**, choose the HTTPS port (default **34443**, **34444** when running from source); under
the advanced settings, supply a currently valid PEM certificate chain and matching unencrypted private key and enable
HTTPS. Restart Electron to apply the saved settings. Both protocols share the
database. If optional HTTPS cannot start, HTTP continues and the administrator sees the error. Private keys are never
returned by the API.

For HTTP, precedence is CLI option, environment variable, `config.json`, saved setting, then default. Overrides do not
replace the saved value. Server settings show an active override and its source; remove it and restart to apply a
different saved port.

| CLI option               | Environment variable | `config.json`   | Default                                                             |
| ------------------------ | -------------------- | --------------- | ------------------------------------------------------------------- |
| `--host <address>`       | `APP_HOST`           | `host`          | `0.0.0.0`                                                           |
| `--http-port <port>`     | `APP_HTTP_PORT`      | `httpPort`      | Saved HTTP port, otherwise `34345` (`34346` from source)            |
| `--data-dir <directory>` | `APP_DATA_DIR`       | `dataDirectory` | Development `.dev-data`; installed Electron per-user data directory |

To set these once, write them in `config.json`: `%APPDATA%\Media Collection\config.json` for the installed application
on Windows (`~/.config/Media Collection/config.json` on Linux), the repository root `config.json` when running from
source. **File → Open configuration file…** opens it (creating it when missing); changes apply at the next start. Leave
out a key to keep the saved setting or the default; an unknown key or an invalid value stops startup with a message
naming the file. `config.sample.json` shows every key, `--config <path>` or `APP_CONFIG` names another file, and
[the configuration document](docs/Media%20Collection/operations/configuration.md) gives the details.

CLI, environment and `config.json` port values must also be in `1024`–`65535`; port `0` is reserved for internal test fixtures.
For example: `npm start -- --http-port 4000 --data-dir ./local-data`. If a saved port is occupied, startup offers
Retry/Quit and reports the port. Launch once with a valid `--http-port` override (or `httpPort` in `config.json`), correct the saved port in Server
settings, then close and reopen without that override. Existing HTTPS settings below `1024` remain visible for
correction
and produce an HTTPS startup error while HTTP remains available.

Keep custom data directories private. Back up the entire data directory with the application closed, including
`application.sqlite`, `session.key`, `tls/` and `covers/` (book cover images). The Electron browser profile lives below `electron-profile/`. Do not
commit storage or keys.

## Local maintenance: Admin recovery, backup and restore

Local maintenance runs only on the computer that hosts Media Collection, with no web server and no sign-in. Open it
from the desktop menu **Maintenance → Open local maintenance…**: the server stops (browsers and phones lose access)
until the maintenance window is closed, then the application starts again. When the application cannot start, open
the same window directly:

```sh
<app> --maintenance [--data-dir <directory>]
```

For a development checkout: `npm run build`, then `npm run maintenance`. On Windows, for example:
`"Media Collection.exe" --maintenance`.

- **Recover Admin access** shows the protected Admin's username and sets a new temporary password, to be replaced at
  the next sign-in. It keeps all data and ends the Admin's sessions.
- **Create a backup** saves all application data (database, covers, HTTPS certificate and settings) in one
  `.mcbackup` file named after its date and time, by default in `Documents/Media Collection backups`. The file holds
  private notes and password hashes: keep it private.
- **Restore a backup** accepts only a backup made by the same Media Collection version, also from another computer.
  After a confirmation it replaces all current data, keeps the backup's accounts and passwords, and ends every session.
  An invalid, damaged or other-version file is rejected and the current data stays unchanged.

The normal application and the maintenance window never use the same data at the same time.

## Development data

Two commands act only on the development data directory, `.dev-data/`, never on an installed release's data. Close the
development application first; they refuse to run while it is open, when the application is packaged, or with a
changed data directory (`--data-dir`, `APP_DATA_DIR`).

```sh
npm run dev:reset-data
npm run dev:import-v1 -- local-imports/v1/books.json
```

`dev:reset-data` deletes the library (books, authors, collections, bookcases, tags, receivers, loans, reading statuses,
personal notes, covers) and the audit log, signs every session out, and keeps the accounts and server settings.

`dev:import-v1` replaces the library with a Media Collection V1 (MongoDB) export, in one transaction: if anything fails,
the previous library stays. It needs the administrator account. Keep the inputs in the Git-ignored `local-imports/v1/`:

- `books.json`: the V1 `books` collection exported as MongoDB Extended JSON.
- `isbn-corrections.json` (optional): `[{ "record": 12, "title": "…", "isbn": "…" }]` for books without an ISBN; the
  record is the position in `books.json`, from 1, and the title must match it.
- `category-corrections.json` (optional): `{ "<collection name>": "books" | "manga" | "comics" }`, overriding the V1
  type of every book of that collection.
- `covers/`: filled by the first import with the downloaded covers, and reused by the next ones.

Every problem in the dump is listed at once before anything is written. The report lists the collections marked
Finished or left unfinished, untitled Books given their collection title, and covers that could not be used. The
mapping rules are in [the plan](docs/Media%20Collection/plans/dev-data-commands.md).

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
folder to keep screenshots of the browser tests for visual review. Browser tests run headless, and the Electron
desktop and packaged tests set `APP_HIDDEN_WINDOWS=1`, so no test window or tray icon appears on screen while you
work; the tray is then an in-memory `HiddenTray`. Vitest runs up to six test files at a time (`maxWorkers` in
`vitest.config.ts`). Controller API tests use isolated application fixtures and an injected clock; no test
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
test a different executable. `package` produces unsigned NSIS or AppImage output on its respective platform (macOS is not supported for now). No
separate Node/npm installation is needed by the installed app. Verification runs locally. Release builds run on
GitHub Actions (`.github/workflows/release.yml`): a `v*` tag builds and smoke-tests the Windows installer and the Linux
AppImage and attaches them to a draft GitHub Release; see [releasing a version](docs/Media%20Collection/operations/releasing.md),
which also gives the installation notes (SmartScreen on Windows, AppImage on Linux).

Oxlint runs selected `@stylistic/eslint-plugin` rules to require braces, multiline block bodies, one instruction per
line, and blank lines around control statements and before returns. Consecutive declarations stay grouped; test files
may preserve blank lines between declarations for Arrange, Act, and Assert. `npm run lint:fix` applies safe lint fixes
and then runs Oxfmt.

See [architecture](docs/Media%20Collection/architecture/architecture.md) and [agent guidance](AGENTS.md), the single source of truth for agents.
Claude agents are redirected there by [.claude/CLAUDE.md](.claude/CLAUDE.md). The backend and lint checks follow the
Screaming/Hexagonal driving/driven/config layout with mandatory SOLID principles.
The [architecture migration record](docs/Media%20Collection/architecture/architecture-migration-plan.md) describes the changes and verification. The
repository [architecture review skill](.agents/skills/architecture-review/SKILL.md)
checks manual additions and must be used before agents finish code changes.
