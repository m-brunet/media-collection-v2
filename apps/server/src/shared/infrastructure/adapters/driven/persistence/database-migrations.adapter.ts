import type { IdGenerator } from '../../../../application/ports/driven/id-generator.interface.js';
import type { Migration, MigrationProvider } from 'kysely/migration';
import { FoundationMigration } from './migrations/001-foundation.js';
import { MediaCollectionFoundationMigration } from './migrations/002-media-collection-foundation.js';
import { AccessAndAuditMigration } from './migrations/003-access-and-audit.js';
import { CaseInsensitiveUsernamesMigration } from './migrations/004-case-insensitive-usernames.js';
import { BooksMigration } from './migrations/005-books.js';
import { UuidPrimaryKeysMigration } from './migrations/006-uuid-primary-keys.js';
import { CollectionsMigration } from './migrations/007-collections.js';
import { LocationsAndTagsMigration } from './migrations/008-locations-and-tags.js';
import { LendingMigration } from './migrations/009-lending.js';
import { GeneratedTitlesMigration } from './migrations/010-generated-titles.js';
import { ColourSchemesMigration } from './migrations/011-colour-schemes.js';

export class DatabaseMigrations implements MigrationProvider {
    constructor(private readonly ids: IdGenerator) {}

    async getMigrations(): Promise<Record<string, Migration>> {
        return {
            '001-foundation': this.migration(new FoundationMigration()),
            '002-media-collection-foundation': this.migration(
                new MediaCollectionFoundationMigration(),
            ),
            '003-access-and-audit': this.migration(new AccessAndAuditMigration()),
            '004-case-insensitive-usernames': this.migration(
                new CaseInsensitiveUsernamesMigration(),
            ),
            '005-books': this.migration(new BooksMigration()),
            '006-uuid-primary-keys': this.migration(new UuidPrimaryKeysMigration(this.ids)),
            '007-collections': this.migration(new CollectionsMigration()),
            '008-locations-and-tags': this.migration(new LocationsAndTagsMigration()),
            '009-lending': this.migration(new LendingMigration()),
            '010-generated-titles': this.migration(new GeneratedTitlesMigration()),
            '011-colour-schemes': this.migration(new ColourSchemesMigration()),
        };
    }

    // Kysely copies enumerable migration properties, so expose the class method as an own callback.
    private migration(migration: Migration): Migration {
        return { up: (db) => migration.up(db) };
    }
}
