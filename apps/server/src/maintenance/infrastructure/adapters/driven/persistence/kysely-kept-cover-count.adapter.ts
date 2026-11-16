import type { KeptCoverCount } from '../../../../application/ports/driven/kept-cover-count.interface.js';
import type { KeptCoverStore } from '../../../../../books/application/ports/driven/kept-cover-store.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyKeptCoverCount implements KeptCoverCount {
    constructor(
        private readonly connections: DatabaseConnections,
        private readonly store: KeptCoverStore,
    ) {}

    async afterReset(): Promise<number> {
        const kept = await this.store.all();
        const books = await this.connections.current
            .selectFrom('books')
            .select('isbn13')
            .where('isbn13', 'is not', null)
            .where('cover_file', 'is not', null)
            .execute();

        return new Set([...kept, ...books].map((cover) => cover.isbn13)).size;
    }
}
