import type { PersonalNoteStore } from '../../../../application/ports/driven/personal-note-store.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Every read and write is scoped to the note's author.
export class KyselyPersonalNoteRepository implements PersonalNoteStore {
    constructor(private readonly connections: DatabaseConnections) {}

    async find(
        userId: string,
        bookId: string,
    ): Promise<{ text: string; updatedAt: string } | null> {
        const row = await this.connections.current
            .selectFrom('personal_notes')
            .select(['text', 'updated_at'])
            .where('user_id', '=', userId)
            .where('book_id', '=', bookId)
            .executeTakeFirst();

        return row ? { text: row.text, updatedAt: row.updated_at } : null;
    }

    async save(userId: string, bookId: string, text: string, updatedAt: string): Promise<void> {
        await this.connections.current
            .insertInto('personal_notes')
            .values({ user_id: userId, book_id: bookId, text, updated_at: updatedAt })
            .onConflict((conflict) =>
                conflict
                    .columns(['user_id', 'book_id'])
                    .doUpdateSet({ text, updated_at: updatedAt }),
            )
            .execute();
    }

    async delete(userId: string, bookId: string): Promise<void> {
        await this.connections.current
            .deleteFrom('personal_notes')
            .where('user_id', '=', userId)
            .where('book_id', '=', bookId)
            .execute();
    }
}
