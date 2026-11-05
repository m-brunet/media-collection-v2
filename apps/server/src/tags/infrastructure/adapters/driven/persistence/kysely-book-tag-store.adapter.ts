import type { BookTagStore } from '../../../../application/ports/driven/book-tag-store.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyBookTagStore implements BookTagStore {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async tagsOf(bookId: string): Promise<string[]> {
        const rows = await this.db
            .selectFrom('book_tags')
            .select('tag_id')
            .where('book_id', '=', bookId)
            .execute();

        return rows.map((row) => row.tag_id);
    }

    async replace(bookId: string, tagIds: readonly string[]): Promise<void> {
        await this.db.deleteFrom('book_tags').where('book_id', '=', bookId).execute();

        if (tagIds.length > 0) {
            await this.db
                .insertInto('book_tags')
                .values(tagIds.map((tagId) => ({ book_id: bookId, tag_id: tagId })))
                .execute();
        }
    }

    async countByTag(): Promise<Map<string, number>> {
        const rows = await this.db
            .selectFrom('book_tags')
            .select((eb) => ['tag_id', eb.fn.countAll<number>().as('books')])
            .groupBy('tag_id')
            .execute();

        return new Map(rows.map((row) => [row.tag_id, Number(row.books)]));
    }
}
