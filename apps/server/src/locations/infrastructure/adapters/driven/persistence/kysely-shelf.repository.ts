import type { ShelfRepository } from '../../../../application/ports/driven/shelf-repository.interface.js';
import { Shelf } from '../../../../domain/entities/shelf.entity.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

type ShelfRow = DatabaseSchema['shelves'];

export class KyselyShelfRepository implements ShelfRepository {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async findById(id: string): Promise<Shelf | null> {
        const row = await this.db
            .selectFrom('shelves')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async findByKey(bookcaseId: string, key: string): Promise<Shelf | null> {
        const row = await this.db
            .selectFrom('shelves')
            .selectAll()
            .where('bookcase_id', '=', bookcaseId)
            .where('name_key', '=', key)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async list(): Promise<Shelf[]> {
        const rows = await this.db.selectFrom('shelves').selectAll().orderBy('name_key').execute();

        return rows.map((row) => this.map(row));
    }

    async ofBookcase(bookcaseId: string): Promise<Shelf[]> {
        const rows = await this.db
            .selectFrom('shelves')
            .selectAll()
            .where('bookcase_id', '=', bookcaseId)
            .orderBy('name_key')
            .execute();

        return rows.map((row) => this.map(row));
    }

    async create(shelf: Shelf): Promise<void> {
        try {
            await this.db.insertInto('shelves').values(this.row(shelf)).execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async save(shelf: Shelf): Promise<void> {
        try {
            await this.db
                .updateTable('shelves')
                .set(this.row(shelf))
                .where('id', '=', shelf.id)
                .execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.deleteFrom('shelves').where('id', '=', id).execute();
    }

    private map(row: ShelfRow): Shelf {
        return new Shelf({
            id: row.id,
            bookcaseId: row.bookcase_id,
            name: row.name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    private row(shelf: Shelf): ShelfRow {
        const state = shelf.snapshot;

        return {
            id: state.id,
            bookcase_id: state.bookcaseId,
            name: state.name,
            name_key: shelf.key,
            created_at: state.createdAt,
            updated_at: state.updatedAt,
        };
    }

    private rethrow(error: unknown): never {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
            error.message.includes('shelves.name_key')
        ) {
            throw new Failure(
                'conflict',
                'This bookcase already has a shelf with this name.',
                'shelf-name-taken',
            );
        }

        throw error;
    }
}
