# Media Collection

Documentation vault for Media Collection: product rules, design and architecture references, and implementation
plans. Product documents are the source of truth for behaviour; [AGENTS.md](../../AGENTS.md) holds the engineering
rules.

## Continue implementation

Start with the [implementation plan](plans/implementation-plan.md) for task status, resume instructions, and the next action. Read the repository [agent instructions](../../AGENTS.md) before changing code.

## Product

- [Product scope](product/product-scope.md): audience, platforms, initial scope, and exclusions.
- [Features](product/features.md): confirmed behaviour across the application.
- [Decisions and open questions](product/decisions-and-open-questions.md): rationale, deferrals, and delivery sequence.
- [Accounts](product/accounts.md): setup, fixed roles, account lifecycle, and personal data.
- [Book entry](product/book-entry.md): book form, ISBN, lookup, and personal notes.
- [Collections and shopping](product/collections.md), with the [edition impact analysis](product/collection-editions-impact.md).
- [Locations, tags, and search](product/locations-tags-search.md).
- [Lending](product/lending.md), with the [lending design brief](design/lending-design-brief.md).
- [Overview, Activity, and mobile](product/overview-activity-mobile.md).

## Design

- [Design guidelines](design/design-guidelines.md): the Libris/Leaf design reference and accessibility baseline.

## Architecture

- [Architecture](architecture/architecture.md): features, layers, ports, and migrations.
- [Architecture migration record](architecture/architecture-migration-plan.md) and
  [review validation](architecture/architecture-review-validation.md).
- [Foundation import](architecture/foundation-import.md): baseline provenance.

## Operations

- [Configuration](operations/configuration.md): everyday settings, startup overrides and `config.json`.
- [Release expectations](operations/release-expectations.md): distribution, languages, and data safety.
- [Application updates](operations/updates.md): release checks and installation.
- [Releasing a version](operations/releasing.md): version, tag, the release workflow, draft and publication.

## Plans

- [Implementation plan](plans/implementation-plan.md): task order, status, and how to resume work.
- Future work: [GitHub Issues](https://github.com/m-brunet/media-collection-v2/issues); fixed issues are recorded in
  [resolved issues](plans/resolved-issues.md).
- Task plans: [0 Platform and UI foundation](plans/task-00-platform-ui-foundation.md),
  [1 Access and accountability](plans/task-01-access-accountability.md),
  [1b Appearance](plans/task-01b-appearance-color-schemes.md), [2 Books](plans/task-02-books.md),
  [UUID keys and Kysely rules](plans/uuid-primary-keys-and-kysely-rules.md),
  [3 Collections](plans/task-03-collections.md),
  [4 Locations, tags, and search](plans/task-04-locations-tags-search.md),
  [5 Lending](plans/task-05-lending.md),
  [5.5 Generated titles](plans/task-05-5-generated-titles.md),
  [5.8 Test entity builders](plans/task-05-8-test-builders.md).
- [Product clarification plan](plans/product-clarification-plan.md): history of the product decisions.
- [Collections design fixes](plans/design-fix-collections.md).
- [Development data commands](plans/dev-data-commands.md).
- [KI-9 and KI-10: Let's Encrypt attempts](plans/ki-09-ki-10-certificate-attempts.md).

## Reading in Obsidian

Open `docs/Media Collection/` as a vault. The graph uses folder colors: product green, design purple, architecture blue, operations medium red, plans orange, and this home page gold. Standard Markdown links also work in GitHub and editors. Agent instructions live outside this vault; open their repository links in your editor.
