import type {
    CollectionPageQuery,
    CollectionRepository,
} from '../../../../application/ports/driven/collection-repository.interface.js';
import { Collection } from '../../../../domain/entities/collection.entity.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

type CollectionRow = DatabaseSchema['collections'];

export class KyselyCollectionRepository implements CollectionRepository {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async findById(id: string): Promise<Collection | null> {
        const row = await this.db
            .selectFrom('collections')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async findByKey(key: string): Promise<Collection | null> {
        const row = await this.db
            .selectFrom('collections')
            .selectAll()
            .where('name_key', '=', key)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async list(): Promise<Collection[]> {
        const rows = await this.db
            .selectFrom('collections')
            .selectAll()
            .orderBy('name_key')
            .execute();

        return rows.map((row) => this.map(row));
    }

    async page(query: CollectionPageQuery): Promise<{ total: number; collections: Collection[] }> {
        if (query.ids?.length === 0) {
            return { total: 0, collections: [] };
        }

        const all = this.db.selectFrom('collections');
        const selected = query.ids === null ? all : all.where('id', 'in', query.ids);
        const counted = await selected
            .select((eb) => eb.fn.countAll<number>().as('total'))
            .executeTakeFirstOrThrow();
        const rows = await selected
            .selectAll()
            .orderBy('name_key', query.direction)
            .orderBy('id')
            .limit(query.limit)
            .offset(query.offset)
            .execute();

        return { total: Number(counted.total), collections: rows.map((row) => this.map(row)) };
    }

    async create(collection: Collection): Promise<void> {
        try {
            await this.db.insertInto('collections').values(this.row(collection)).execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async save(collection: Collection): Promise<void> {
        try {
            await this.db
                .updateTable('collections')
                .set(this.row(collection))
                .where('id', '=', collection.id)
                .execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.deleteFrom('collections').where('id', '=', id).execute();
    }

    private map(row: CollectionRow): Collection {
        return new Collection({
            id: row.id,
            name: row.name,
            category: row.category,
            includesVolumeZero: Boolean(row.includes_volume_zero),
            finished: Boolean(row.finished),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    private row(collection: Collection): CollectionRow {
        const state = collection.snapshot;

        return {
            id: state.id,
            name: state.name,
            name_key: collection.key,
            category: state.category,
            includes_volume_zero: Number(state.includesVolumeZero),
            finished: Number(state.finished),
            created_at: state.createdAt,
            updated_at: state.updatedAt,
        };
    }

    private rethrow(error: unknown): never {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
            error.message.includes('collections.name_key')
        ) {
            throw new Failure(
                'conflict',
                'Another collection already has this name.',
                'collection-name-taken',
            );
        }

        throw error;
    }
}
