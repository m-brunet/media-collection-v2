# UUID primary keys and Kysely SQL boundaries

Status: done. Implemented in commit `5bc0aa2` and merged into `master` through PR #1
(`768b283`). Summary recorded on 2026-11-05.

## Decisions

- Application-owned tables with a single-column primary key use a UUID `id`, stored as SQLite
  `TEXT NOT NULL PRIMARY KEY` with a UUID-format CHECK constraint. SQLite has no native UUID type.
- Keep native `node:crypto.randomUUID()` behind the existing `IdGenerator` port; no UUID package was added.
- Composite primary keys and Kysely-owned migration bookkeeping tables are exempt.
- Audit subject identifiers may remain descriptive strings, such as `http` and `https`, or null.
- Production adapters use Kysely builders. Raw SQL is permitted in historical migrations and database-boundary tests.
- Connection construction and the foreign-key, WAL and timeout PRAGMAs retain a narrow driver-configuration exception.

## Implemented

1. Extracted migrations 001-005 into shared driven persistence's `migrations/` folder, preserving their names,
   ordering and behavior. Added `DatabaseMigrations` to supply them to Kysely.
2. Added migration `006-uuid-primary-keys`:
   - Converts audit-row integer IDs to UUIDs.
   - Adds UUID IDs to settings while retaining unique names for lookup.
   - Enforces UUID format and explicit non-null primary keys for users, authors, books, audit logs and settings.
   - Preserves valid entity IDs, table data, relationships, cover filenames and indexes; composite keys stay unchanged.
   - Rejects invalid legacy entity IDs with an explicit repair message instead of silently remapping them.
   - Uses an explicit transaction because Kysely's SQLite migrator does not automatically provide one.
   - Safely retries a committed rebuild if the process stopped before the migration completion record was saved.
3. Updated audit and settings adapters and composition to supply UUIDs through the ID generator.
   Settings updates preserve the existing row identity.
4. Replaced catalog raw SQL with Kysely expressions for publication ordering and literal substring searches on
   normalized title/author keys. Searches use SQLite `instr()` through Kysely's function builder.
5. Added architecture lint enforcement for raw-SQL imports/re-exports, direct driver execution, migration access
   from runtime adapters, and the restricted connection PRAGMAs. Migration exceptions use the dedicated folder.
6. Documented the rules in `AGENTS.md` and [architecture](../architecture.md).

## Verification

- Added isolated SQLite coverage for primary-key types and constraints, populated upgrades, preserved relationships,
  settings uniqueness, invalid legacy IDs, rollback after a failed restoration, and migration retry safety.
- Added architecture-rule regression tests and HTTP regressions for literal underscore/backslash searches and
  ascending publication-date ordering with undated books last.
- Updated persisted test fixtures to use UUIDs and the audit probe to retain insertion ordering independently of UUIDs.
- Full `npm run check` passed: build, typecheck, lint, format check and 844 tests across 102 files.
- The dedicated architecture suite passed all 77 tests. Architecture review found no outstanding violations.
- After the final ID-generator wiring adjustment, runtime build, typecheck, lint, format check, architecture tests
  and all 13 UUID migration tests passed again.

## Operational notes

- An installation containing non-UUID legacy user, author or book IDs requires explicit data repair before upgrade.
  The migration rejects those records without silently changing their identities.
- Cover storage was inspected but not changed: complete image files live in `<data-directory>/covers/` under UUID
  filenames; SQLite stores only the filename. Backups need both the database and cover directory.
- The work branch was created from `master`, the repository's default branch; no `main` branch existed.
