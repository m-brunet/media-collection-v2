import type { AuthorRepository } from '../../../../application/ports/driven/author-repository.interface.js';
import { Author } from '../../../../domain/entities/author.entity.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';

export class KyselyAuthorRepository implements AuthorRepository {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async findById(id: string): Promise<Author | null> {
        const row = await this.db
            .selectFrom('authors')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async findByIds(ids: readonly string[]): Promise<Author[]> {
        if (ids.length === 0) {
            return [];
        }

        const rows = await this.db
            .selectFrom('authors')
            .selectAll()
            .where('id', 'in', ids)
            .execute();

        return rows.map((row) => this.map(row));
    }

    async findByKey(key: string): Promise<Author | null> {
        const row = await this.db
            .selectFrom('authors')
            .selectAll()
            .where('name_key', '=', key)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async list(): Promise<Author[]> {
        return (await this.db.selectFrom('authors').selectAll().orderBy('name_key').execute()).map(
            (row) => this.map(row),
        );
    }

    async create(author: Author): Promise<void> {
        try {
            await this.db.insertInto('authors').values(this.row(author)).execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async save(author: Author): Promise<void> {
        try {
            await this.db
                .updateTable('authors')
                .set(this.row(author))
                .where('id', '=', author.snapshot.id)
                .execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async removeUnlinked(ids: readonly string[]): Promise<void> {
        if (ids.length === 0) {
            return;
        }

        await this.db
            .deleteFrom('authors')
            .where('id', 'in', ids)
            .where((eb) =>
                eb.not(
                    eb.exists(
                        eb
                            .selectFrom('book_authors')
                            .select('book_authors.author_id')
                            .whereRef('book_authors.author_id', '=', 'authors.id'),
                    ),
                ),
            )
            .execute();
    }

    private map(row: DatabaseSchema['authors']): Author {
        return new Author({ id: row.id, name: row.name, createdAt: row.created_at });
    }

    private row(author: Author): DatabaseSchema['authors'] {
        const { id, name, createdAt } = author.snapshot;

        return { id, name, name_key: author.key, created_at: createdAt };
    }

    private rethrow(error: unknown): never {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
            throw new Failure(
                'conflict',
                'Another author already has an equivalent name.',
                'author-name-taken',
            );
        }

        throw error;
    }
}
