import type { ReadingStatusStore } from '../../../../application/ports/driven/reading-status-store.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyReadingStatusRepository implements ReadingStatusStore {
    constructor(private readonly connections: DatabaseConnections) {}

    async isRead(userId: string, bookId: string): Promise<boolean> {
        const row = await this.connections.current
            .selectFrom('reading_statuses')
            .select('read')
            .where('user_id', '=', userId)
            .where('book_id', '=', bookId)
            .executeTakeFirst();

        return Boolean(row?.read);
    }

    async set(userId: string, bookId: string, read: boolean): Promise<void> {
        await this.connections.current
            .insertInto('reading_statuses')
            .values({ user_id: userId, book_id: bookId, read: Number(read) })
            .onConflict((conflict) =>
                conflict.columns(['user_id', 'book_id']).doUpdateSet({ read: Number(read) }),
            )
            .execute();
    }
}
