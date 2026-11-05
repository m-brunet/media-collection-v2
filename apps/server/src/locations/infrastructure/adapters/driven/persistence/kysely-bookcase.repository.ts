import type { BookcaseRepository } from '../../../../application/ports/driven/bookcase-repository.interface.js';
import { Bookcase } from '../../../../domain/entities/bookcase.entity.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

type BookcaseRow = DatabaseSchema['bookcases'];

export class KyselyBookcaseRepository implements BookcaseRepository {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async findById(id: string): Promise<Bookcase | null> {
        const row = await this.db
            .selectFrom('bookcases')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async findByKey(key: string): Promise<Bookcase | null> {
        const row = await this.db
            .selectFrom('bookcases')
            .selectAll()
            .where('name_key', '=', key)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async list(): Promise<Bookcase[]> {
        const rows = await this.db
            .selectFrom('bookcases')
            .selectAll()
            .orderBy('name_key')
            .execute();

        return rows.map((row) => this.map(row));
    }

    async create(bookcase: Bookcase): Promise<void> {
        try {
            await this.db.insertInto('bookcases').values(this.row(bookcase)).execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async save(bookcase: Bookcase): Promise<void> {
        try {
            await this.db
                .updateTable('bookcases')
                .set(this.row(bookcase))
                .where('id', '=', bookcase.id)
                .execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.deleteFrom('bookcases').where('id', '=', id).execute();
    }

    private map(row: BookcaseRow): Bookcase {
        return new Bookcase({
            id: row.id,
            name: row.name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    private row(bookcase: Bookcase): BookcaseRow {
        const state = bookcase.snapshot;

        return {
            id: state.id,
            name: state.name,
            name_key: bookcase.key,
            created_at: state.createdAt,
            updated_at: state.updatedAt,
        };
    }

    private rethrow(error: unknown): never {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
            error.message.includes('bookcases.name_key')
        ) {
            throw new Failure(
                'conflict',
                'Another bookcase already has this name.',
                'bookcase-name-taken',
            );
        }

        throw error;
    }
}
