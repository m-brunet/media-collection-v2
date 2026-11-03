import type { Kysely } from 'kysely';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { User } from '../../../../domain/entities/user.entity.js';
import type { UserRepository } from '../../../../application/ports/driven/user-repository.interface.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';

export class KyselyUserRepository implements UserRepository {
    constructor(private readonly db: Kysely<DatabaseSchema>) {}

    async findById(id: string): Promise<User | null> {
        const row = await this.db
            .selectFrom('users')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async findByUsername(username: string): Promise<User | null> {
        const row = await this.db
            .selectFrom('users')
            .selectAll()
            .where('username', '=', username)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async list(): Promise<User[]> {
        return (await this.db.selectFrom('users').selectAll().orderBy('created_at').execute()).map(
            (row) => this.map(row),
        );
    }

    async create(user: User): Promise<void> {
        try {
            await this.db.insertInto('users').values(this.row(user)).execute();
        } catch (error) {
            this.rethrow(error);
        }
    }

    async save(user: User, expectedVersion: number): Promise<void> {
        try {
            const result = await this.db
                .updateTable('users')
                .set(this.row(user))
                .where('id', '=', user.actor.id)
                .where('token_version', '=', expectedVersion)
                .executeTakeFirst();

            if (result.numUpdatedRows === 0n) {
                throw new Failure(
                    'conflict',
                    'The account changed during this request. Reload and try again.',
                );
            }
        } catch (error) {
            this.rethrow(error);
        }
    }

    private map(row: DatabaseSchema['users']): User {
        return new User({
            id: row.id,
            username: row.username,
            role: row.role === 'admin' ? 'admin' : 'user',
            passwordHash: row.password_hash,
            mustChangePassword: Boolean(row.must_change_password),
            tokenVersion: row.token_version,
            createdAt: row.created_at,
            language: row.language === 'en' || row.language === 'fr' ? row.language : null,
        });
    }

    private row(user: User): DatabaseSchema['users'] {
        const s = user.snapshot;

        return {
            id: s.id,
            username: s.username,
            role: s.role,
            password_hash: s.passwordHash,
            must_change_password: Number(s.mustChangePassword),
            token_version: s.tokenVersion,
            created_at: s.createdAt,
            language: s.language,
        };
    }

    private rethrow(error: unknown): never {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
            throw new Failure('conflict', 'That username is already in use.');
        }

        throw error;
    }
}
