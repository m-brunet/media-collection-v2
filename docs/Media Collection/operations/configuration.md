# Configuration

Status: implemented (#59, 2026-11-12).

## Everyday settings and startup overrides

Users manage everyday settings through the application interface, stored in the SQLite settings storage of the data
directory. Startup overrides change where and how the application starts without replacing a saved setting.

The startup settings are `host`, `httpPort` and `dataDirectory`. Each has three override sources, in this order of
precedence:

1. a command-line option: `--host`, `--http-port`, `--data-dir`;
2. an environment variable: `APP_HOST`, `APP_HTTP_PORT`, `APP_DATA_DIR`;
3. the configuration file `config.json`.

Without an override, the HTTP port is the port saved in Server settings, otherwise the default. The host defaults to
`0.0.0.0`, the data directory to the default one below. The HTTPS port is a Server settings value only; it has no
override.

Server settings says when the running HTTP port comes from an override and from which source (command line,
environment or `config.json`). Saving another port keeps it for when the override is removed.

## Development and release

|                    | Installed release                            | Development (unpackaged: `npm run dev`, `npm start`) |
| ------------------ | -------------------------------------------- | ---------------------------------------------------- |
| Default HTTP port  | 34345                                        | 34346                                                |
| Default HTTPS port | 34443                                        | 34444                                                |
| Data directory     | per-user application data folder             | `.dev-data/` in the repository                       |
| `config.json`      | `%APPDATA%\Media Collection\config.json` (Windows), `~/.config/Media Collection/config.json` (Linux) | `config.json` at the repository root (ignored by Git) |

Development and release therefore run side by side on one computer without any setting, and neither reads the other's
file. To tell them apart, development adds " (dev)" to the Libris window title and to the tray icon name ("Media
Collection (dev)"); the application name behind its folders stays "Media Collection". The defaults only apply while nothing is saved: a port saved in Server settings keeps applying. Both ports are set in
Server settings › Ports and are also the outside ports on the router when internet access is on ([issue #21](../plans/issue-21-internet-ports.md));
an update moves a saved HTTPS port of 3443 to 34443.

## The configuration file

`config.json` is a JSON object; every key is optional, and a missing key means "not set by the file". A missing file
sets nothing. `config.sample.json` at the repository root shows every key:

| Key             | Value                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| `host`          | Listening address, for example `0.0.0.0` (every network) or `127.0.0.1` (this computer only) |
| `httpPort`      | Whole number from 1024 to 65535                                                              |
| `dataDirectory` | Data folder; a relative path is read from the folder of `config.json`                        |

- The file is always read from the default place above, even when its `dataDirectory` moves the data elsewhere.
  `--config <path>` or `APP_CONFIG` names another file.
- Validation is strict. Invalid JSON, an unknown key (a typo), `null`, an empty text or a port out of range stops
  startup with the "Invalid application configuration" dialog naming the file and the problem. A byte order mark
  (Notepad) is accepted.
- Changes apply the next time the application starts.
- **File → Open configuration file…** opens the file in the default editor, creating it as `{}` when missing.

The file holds no secrets. Session signing keys, TLS private keys and the Let's Encrypt account key stay in their
protected files of the data directory. No `.env` file is read.

## Implementation

- `apps/desktop/src/configuration-file.adapter.ts` (`ConfigurationFile`) reads and validates the file and creates it
  for the menu entry.
- `DesktopConfigurationParser` (`apps/desktop/src/configuration.util.ts`) merges command line, environment and file,
  keeps the source of the HTTP port, finds the file (`configurationPath`) and gives the default ports
  (`defaultPorts`).
- The Electron main process passes the result and the default ports to the backend process; `BackendRuntime` uses
  them for the saved-setting defaults (`KyselyHttpSettingsRepository`, `FileTlsStore`) and reports the override in
  `running.httpPortOverride`.
