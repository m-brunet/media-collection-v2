import type {
    KeptCover,
    KeptCoverStore,
} from '../../../../application/ports/driven/kept-cover-store.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyKeptCoverStore implements KeptCoverStore {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async find(isbn13: string): Promise<KeptCover | null> {
        const row = await this.db
            .selectFrom('kept_covers')
            .selectAll()
            .where('isbn13', '=', isbn13)
            .executeTakeFirst();

        return row ? KyselyKeptCoverStore.cover(row) : null;
    }

    async put(cover: KeptCover): Promise<void> {
        await this.remove(cover.isbn13);
        await this.db
            .insertInto('kept_covers')
            .values({
                id: cover.id,
                isbn13: cover.isbn13,
                file: cover.file,
                kept_at: cover.keptAt,
            })
            .execute();
    }

    async remove(isbn13: string): Promise<void> {
        await this.db.deleteFrom('kept_covers').where('isbn13', '=', isbn13).execute();
    }

    async all(): Promise<KeptCover[]> {
        const rows = await this.db
            .selectFrom('kept_covers')
            .selectAll()
            .orderBy('kept_at')
            .execute();

        return rows.map((row) => KyselyKeptCoverStore.cover(row));
    }

    async clear(): Promise<number> {
        const deleted = await this.db.deleteFrom('kept_covers').executeTakeFirst();

        return Number(deleted.numDeletedRows);
    }

    private static cover(row: {
        id: string;
        isbn13: string;
        file: string;
        kept_at: string;
    }): KeptCover {
        return { id: row.id, isbn13: row.isbn13, file: row.file, keptAt: row.kept_at };
    }
}
