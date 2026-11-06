# Media Collection

Documentation vault for Media Collection: product rules, design and architecture references, and implementation
plans. Product documents are the source of truth for behaviour; [AGENTS.md](../../AGENTS.md) holds the engineering
rules.

## Product

- [Product scope](product-scope.md): audience, platforms, initial scope, and exclusions.
- [Features](features.md): confirmed behaviour across the application.
- [Decisions and open questions](decisions-and-open-questions.md): rationale, deferrals, and delivery sequence.
- [Accounts](accounts.md): setup, fixed roles, account lifecycle, and personal data.
- [Book entry](book-entry.md): book form, ISBN, lookup, and personal notes.
- [Collections and shopping](collections.md), with the [edition impact analysis](collection-editions-impact.md).
- [Locations, tags, and search](locations-tags-search.md).
- [Lending](lending.md), with the [lending design brief](lending-design-brief.md).
- [Overview, Activity, and mobile](overview-activity-mobile.md).
- [Release expectations](release-expectations.md) and [application updates](updates.md).

## Design and configuration

- [Design guidelines](design-guidelines.md): the Libris/Leaf design reference and accessibility baseline.
- [Configuration](configuration.md): everyday settings and startup overrides.

## Architecture

- [Architecture](architecture.md): features, layers, ports, and migrations.
- [Architecture migration record](architecture-migration-plan.md) and
  [review validation](architecture-review-validation.md).
- [Foundation import](foundation-import.md): baseline provenance.

## Plans

- [Implementation plan](plans/implementation-plan.md): task order, status, and how to resume work.
- Task plans: [0 Platform and UI foundation](plans/task-00-platform-ui-foundation.md),
  [1 Access and accountability](plans/task-01-access-accountability.md),
  [1b Appearance](plans/task-01b-appearance-color-schemes.md), [2 Books](plans/task-02-books.md),
  [UUID keys and Kysely rules](plans/uuid-primary-keys-and-kysely-rules.md),
  [3 Collections](plans/task-03-collections.md),
  [4 Locations, tags, and search](plans/task-04-locations-tags-search.md),
  [5 Lending](plans/task-05-lending.md),
  [5.8 Test entity builders](plans/task-05-8-test-builders.md).
- [Product clarification plan](plans/product-clarification-plan.md): history of the product decisions.
