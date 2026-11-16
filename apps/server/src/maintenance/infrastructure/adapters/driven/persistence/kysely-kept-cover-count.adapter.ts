import type { KeptCoverCount } from '../../../../application/ports/driven/kept-cover-count.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyKeptCoverCount implements KeptCoverCount {
    constructor(private readonly connections: DatabaseConnections) {}

    async afterReset(): Promise<number> {
        const db = this.connections.current;
        const kept = await db.selectFrom('kept_covers').select('isbn13').execute();
        const books = await db
            .selectFrom('books')
            .select('isbn13')
            .where('isbn13', 'is not', null)
            .where('cover_file', 'is not', null)
            .execute();

        return new Set([...kept, ...books].map((row) => row.isbn13)).size;
    }
}
