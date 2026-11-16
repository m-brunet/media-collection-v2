import type { CoverFileCleanup } from '../../../../application/ports/driven/cover-file-cleanup.interface.js';
import type { CoverStorage } from '../../../../../books/application/ports/driven/cover-storage.interface.js';
import type { KeptCoverStore } from '../../../../../books/application/ports/driven/kept-cover-store.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyCoverFileCleanup implements CoverFileCleanup {
    constructor(
        private readonly connections: DatabaseConnections,
        private readonly covers: CoverStorage,
        private readonly kept: KeptCoverStore,
    ) {}

    async removeUnreferenced(): Promise<number> {
        const books = await this.connections.current
            .selectFrom('books')
            .select('cover_file')
            .where('cover_file', 'is not', null)
            .execute();
        const kept = await this.kept.all();
        const referenced = new Set([
            ...books.map((row) => row.cover_file),
            ...kept.map((cover) => cover.file),
        ]);
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
