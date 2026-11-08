import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';

// Checks a restored data directory before it replaces the current one: the database opens with
// exactly the current schema, has a protected Admin, and every book cover it names is present.
export class RestoredDataCheck {
    constructor(private readonly ids: IdGenerator) {}

    async check(directory: string): Promise<void> {
        let usable = false;

        try {
            const database = Database.openExisting(directory);

            try {
                usable =
                    (await database.isUpToDate(this.ids)) &&
                    (await this.hasAdministrator(database)) &&
                    (await this.hasEveryCover(database, directory));
            } finally {
                await database.close();
            }
        } catch {
            usable = false;
        }

        if (!usable) {
            throw new Failure('invalid_input', 'The backup file is damaged.', 'backup-damaged');
        }
    }

    private async hasAdministrator(database: Database): Promise<boolean> {
        const administrator = await database.connection
            .selectFrom('users')
            .select('id')
            .where('role', '=', 'admin')
            .executeTakeFirst();

        return administrator !== undefined;
    }

    private async hasEveryCover(database: Database, directory: string): Promise<boolean> {
        const books = await database.connection
            .selectFrom('books')
            .select('cover_file')
            .where('cover_file', 'is not', null)
            .execute();

        return books.every((book) => existsSync(join(directory, 'covers', book.cover_file!)));
    }
}
