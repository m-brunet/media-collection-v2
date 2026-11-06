import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { CoverFileCleanup } from '../../../../application/ports/driven/cover-file-cleanup.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Compares `<data directory>/covers` with the books' cover references. Only files named like stored
// covers are candidates; anything else in the folder is left alone.
export class KyselyCoverFileCleanup implements CoverFileCleanup {
    private static readonly coverFile = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly dataDirectory: string,
    ) {}

    async removeUnreferenced(): Promise<number> {
        const directory = join(this.dataDirectory, 'covers');
        const rows = await this.connections.current
            .selectFrom('books')
            .select('cover_file')
            .where('cover_file', 'is not', null)
            .execute();
        const referenced = new Set(rows.map((row) => row.cover_file));
        let removed = 0;

        for (const file of await this.files(directory)) {
            if (KyselyCoverFileCleanup.coverFile.test(file) && !referenced.has(file)) {
                await rm(join(directory, file), { force: true });
                removed++;
            }
        }

        return removed;
    }

    private async files(directory: string): Promise<string[]> {
        try {
            return await readdir(directory);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }

            throw error;
        }
    }
}
