import type { BookShelfStore } from '../../../../application/ports/driven/book-shelf-store.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyBookShelfStore implements BookShelfStore {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async shelfOf(bookId: string): Promise<string | null> {
        const row = await this.db
            .selectFrom('book_shelves')
            .select('shelf_id')
            .where('book_id', '=', bookId)
            .executeTakeFirst();

        return row?.shelf_id ?? null;
    }

    async place(bookId: string, shelfId: string): Promise<void> {
        await this.remove(bookId);
        await this.db
            .insertInto('book_shelves')
            .values({ book_id: bookId, shelf_id: shelfId })
            .execute();
    }

    async remove(bookId: string): Promise<void> {
        await this.db.deleteFrom('book_shelves').where('book_id', '=', bookId).execute();
    }

    async countByShelf(): Promise<Map<string, number>> {
        const rows = await this.db
            .selectFrom('book_shelves')
            .select((eb) => ['shelf_id', eb.fn.countAll<number>().as('books')])
            .groupBy('shelf_id')
            .execute();

        return new Map(rows.map((row) => [row.shelf_id, Number(row.books)]));
    }
}
