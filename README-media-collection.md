# Media Collection v2

A personal application for managing a shared home book library, its physical bookcases and shelves, and book collections.

The application uses electron-base-app as its foundation. Its source, tests, build configuration, and agent rules have been imported unchanged; Media Collection features have not been implemented. The earlier Media Collection and mobile projects supplied ideas only; their code and feature sets are not a specification for v2.

## Documentation

The documentation is an [Obsidian](https://obsidian.md) vault: open the `docs/Media Collection/` folder as a vault in Obsidian, starting from [Home](docs/Media%20Collection/home.md). It holds the product documents below and the [implementation plans](docs/Media%20Collection/plans/implementation-plan.md). Links are standard relative Markdown links, so they also work on GitHub and in editors.

- [Product scope](docs/Media%20Collection/product/product-scope.md): audience, platforms, initial scope, and exclusions.
- [Features](docs/Media%20Collection/product/features.md): confirmed behavior and explicitly unresolved details.
- [Book entry](docs/Media%20Collection/product/book-entry.md): Task 2 form, ISBN, lookup, and personal-note decisions.
- [Locations, tags, and search](docs/Media%20Collection/product/locations-tags-search.md): completed Task 3 rules and acceptance examples.
- [Accounts](docs/Media%20Collection/product/accounts.md): completed Task 5 setup, fixed-role account lifecycle, and personal-data rules.
- [Overview, Activity, and mobile](docs/Media%20Collection/product/overview-activity-mobile.md): completed Task 6 rules, screen reconciliation, and acceptance examples.
- [Release expectations](docs/Media%20Collection/operations/release-expectations.md): completed Task 7 languages, offline use, backup/restore, reset rules, and acceptance examples.
- [Application updates](docs/Media%20Collection/operations/updates.md): approved GitHub Releases distribution, Windows integrated updates, manual Linux updates with backup assistance (no macOS for now), and acceptance examples.
- [Collections and shopping](docs/Media%20Collection/product/collections.md): completed Task 1 rules and acceptance examples.
- [Edition impact analysis](docs/Media%20Collection/product/collection-editions-impact.md): book counts versus volume coverage.
- [Decisions and open questions](docs/Media%20Collection/product/decisions-and-open-questions.md): rationale, recommendations, and questions to resolve before implementation.
- [Design guidelines](docs/Media%20Collection/design/design-guidelines.md): design reference location and authority, product names (Libris, Leaf), icon sets, accessibility, and window size.
- [Foundation import](docs/Media%20Collection/architecture/foundation-import.md): baseline provenance and verification.
- [Configuration](docs/Media%20Collection/operations/configuration.md): everyday settings and optional startup overrides.
- [Lending](docs/Media%20Collection/product/lending.md): business flows, open decisions, and implementation-planning handoff.
- [Lending design brief](docs/Media%20Collection/design/lending-design-brief.md): required lending screens and states.

The product is Media Collection: its desktop web interface is Libris and its mobile web interface is Leaf. These documents describe v2 even where design filenames contain `v3`. Latest explicit product decisions take precedence over the design artifact. Proposals and open questions are not accepted requirements.
