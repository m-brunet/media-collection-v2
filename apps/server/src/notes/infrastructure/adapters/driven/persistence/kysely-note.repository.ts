import type { Kysely } from 'kysely';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { Note } from '../../../../domain/entities/note.entity.js';
import type { NoteRepository } from '../../../../application/ports/driven/note-repository.interface.js';

export class KyselyNoteRepository implements NoteRepository {
    constructor(private readonly db: Kysely<DatabaseSchema>) {}

    async list(ownerId: string): Promise<Note[]> {
        return (
            await this.db
                .selectFrom('notes')
                .selectAll()
                .where('owner_id', '=', ownerId)
                .orderBy('updated_at', 'desc')
                .orderBy('id')
                .execute()
        ).map((row) => this.map(row));
    }

    async find(ownerId: string, id: string): Promise<Note | null> {
        const row = await this.db
            .selectFrom('notes')
            .selectAll()
            .where('owner_id', '=', ownerId)
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async create(note: Note): Promise<void> {
        await this.db.insertInto('notes').values(this.row(note)).execute();
    }

    async save(note: Note): Promise<boolean> {
        const row = this.row(note);
        const result = await this.db
            .updateTable('notes')
            .set({ title: row.title, body: row.body, updated_at: row.updated_at })
            .where('id', '=', row.id)
            .where('owner_id', '=', row.owner_id)
            .executeTakeFirst();

        return result.numUpdatedRows > 0n;
    }

    async delete(ownerId: string, id: string): Promise<boolean> {
        const result = await this.db
            .deleteFrom('notes')
            .where('owner_id', '=', ownerId)
            .where('id', '=', id)
            .executeTakeFirst();

        return result.numDeletedRows > 0n;
    }

    private map(r: DatabaseSchema['notes']): Note {
        return new Note({
            id: r.id,
            ownerId: r.owner_id,
            title: r.title,
            body: r.body,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        });
    }

    private row(note: Note): DatabaseSchema['notes'] {
        const s = note.snapshot;

        return {
            id: s.id,
            owner_id: s.ownerId,
            title: s.title,
            body: s.body,
            created_at: s.createdAt,
            updated_at: s.updatedAt,
        };
    }
}
