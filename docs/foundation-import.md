# Foundation import

The initial application baseline was copied on 2026-10-31 from `E:/repos/electron-base-app/electron-based-app` (origin: `git@github.com:m-brunet/electron-base-app.git`, HEAD: `a243ac175d07a5b540e32d92de8cc132daf49e7e`). The actual existing working files were used, not a separate checkout of HEAD.

Imported 197 existing version-controlled files, including application code, tests, package manifests and lockfile, build configuration, GitHub automation, architecture documentation, `AGENTS.md`, `.agents/`, and `.claude/`. All copied files were byte-identical to the source immediately after import. The unchanged source license also matches this repository's existing license.

The source had two stale index entries for absent `http-settings.helper.ts` / `http-settings.helper.spec.ts` files in `apps/server/src/server-settings/domain/`; absent files were not imported. No application files were edited or renamed, and package identity and branding still belong to Electron Base.

Excluded Git history/configuration, dependencies, build/package outputs, caches, local data, IDE state, local plans, and ignored machine-specific files. This repository retains its own remote and local Git author settings. `.gitignore` combines the foundation rules with this project's local-reference exclusions and `.vscode/`; `.idea/` and `.plans/` are ignored too. The local `.plans/` directory exists but is intentionally absent from commits.

The foundation README remains at `README.md`. The Media Collection overview is preserved at [README-media-collection.md](../README-media-collection.md), with product requirements in this folder. Product documentation was preserved. The design references present at import were later retired in favour of the external design artifact; see [design guidelines](design-guidelines.md).

This import is not an implementation of the v2 product requirements. The foundation's existing Notes example, account behavior, and network defaults describe the copied baseline; planned v2 rules in the product documents take precedence for future implementation. In particular, do not assume role permissions or the agreed collection/audit features already exist.

Verification: SHA-256 comparison of all 197 copied files, ignore-rule checks, and staged whitespace validation. Dependencies were not installed and application tests/build were not executed for this copy-only import.
