# Configuration

Status: accepted technical direction. This document does not describe a completed config-file implementation.

## Repository files

- Root `config.sample.json` is a versioned draft showing candidate `host` and `httpPort` overrides, using the foundation's current defaults (HTTP port 3000). It contains no secrets. The agreed product default HTTP port is 34345; the foundation default must change to it when this is implemented.
- Root `config.json` is ignored by Git. An empty local file is provided as a starting point, without overrides.
- Neither file is currently loaded by the application. Creating or editing them does not change runtime behavior yet. The sample is a proposed shape, not an implemented configuration contract.
- The repository location is for development preparation; the installed application's discovery location is still undecided.

## Everyday settings and startup overrides

Users manage everyday settings through the application interface. Keep these settings in the existing persistent settings storage; users should not need to edit files for normal use.

Provide an optional `config.json` for startup overrides, with a `config.sample.json` documenting supported options without real secrets. Overrides do not replace saved settings. The interface should clearly identify overridden settings so changes to a saved value are not mistaken for changes to the running configuration.

The configuration file belongs outside installed application files so application updates do not overwrite it. Its discovery location must be defined independently of any data-directory override it contains. File location, exact schema, supported options, validation/error handling, restart behavior, and precedence relative to command-line options and environment variables remain to be decided.

## Existing foundation

The copied foundation reads command-line options and environment variables for host, HTTP port, and data directory. It stores server settings in SQLite. HTTP port precedence is currently command line, environment, saved setting, then default. The optional JSON file is not implemented yet; its place in that precedence is unresolved.

SQLite is a local database and requires no database login credentials. The database path normally follows the application data directory. No configurable public/base URL is currently required; Electron discovers its local backend address from startup readiness information.

Keep generated session signing keys and TLS private keys in their existing separate protected files, not in the sample configuration. Future external-service credentials require a separate storage decision. No `.env` loading is introduced by this decision.
