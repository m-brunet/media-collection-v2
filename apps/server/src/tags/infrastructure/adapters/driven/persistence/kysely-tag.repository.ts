import type { TagRepository } from '../../../../application/ports/driven/tag-repository.interface.js';
import { Tag } from '../../../../domain/entities/tag.entity.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

type TagRow = DatabaseSchema['tags'];

export class KyselyTagRepository implements TagRepository {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async findById(id: string): Promise<Tag | null> {
        const row = await this.db
            .selectFrom('tags')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async findByKey(key: string): Promise<Tag | null> {
        const row = await this.db
            .selectFrom('tags')
            .selectAll()
            .where('name_key', '=', key)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async list(): Promise<Tag[]> {
        const rows = await this.db.selectFrom('tags').selectAll().orderBy('name_key').execute();

        return rows.map((row) => this.map(row));
    }

    async create(tag: Tag): Promise<void> {
        try {
            await this.db.insertInto('tags').values(this.row(tag)).execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async save(tag: Tag): Promise<void> {
        try {
            await this.db.updateTable('tags').set(this.row(tag)).where('id', '=', tag.id).execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.deleteFrom('tags').where('id', '=', id).execute();
    }

    private map(row: TagRow): Tag {
        return new Tag({
            id: row.id,
            name: row.name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    private row(tag: Tag): TagRow {
        const state = tag.snapshot;

        return {
            id: state.id,
            name: state.name,
            name_key: tag.key,
            created_at: state.createdAt,
            updated_at: state.updatedAt,
        };
    }

    private rethrow(error: unknown): never {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
            error.message.includes('tags.name_key')
        ) {
            throw new Failure('conflict', 'Another tag already has this name.', 'tag-name-taken');
        }

        throw error;
    }
}
