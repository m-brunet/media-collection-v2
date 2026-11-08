import type { CoverFileCleanup } from '../../../../application/ports/driven/cover-file-cleanup.interface.js';
import type { CoverStorage } from '../../../../../books/application/ports/driven/cover-storage.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Compares the books' cover references with the covers the books storage holds, and removes the
// stored covers no book refers to. The storage decides what a stored cover is.
export class KyselyCoverFileCleanup implements CoverFileCleanup {
    constructor(
        private readonly connections: DatabaseConnections,
        private readonly covers: CoverStorage,
    ) {}

    async removeUnreferenced(): Promise<number> {
        const rows = await this.connections.current
            .selectFrom('books')
            .select('cover_file')
            .where('cover_file', 'is not', null)
            .execute();
        const referenced = new Set(rows.map((row) => row.cover_file));
        let removed = 0;

        for (const file of await this.covers.list()) {
            if (!referenced.has(file)) {
                await this.covers.remove(file);
                removed++;
            }
        }

        return removed;
    }
}
