import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

interface UsersTable {
    id: string;
    username: string;
    role: string;
    password_hash: string;
    must_change_password: number;
    token_version: number;
    created_at: string;
}

interface NotesTable {
    id: string;
    owner_id: string;
    title: string;
    body: string;
    created_at: string;
    updated_at: string;
}

interface SettingsTable {
    name: string;
    value: string;
}

export interface DatabaseSchema {
    users: UsersTable;
    notes: NotesTable;
    server_settings: SettingsTable;
}

export class Database {
    readonly connection: Kysely<DatabaseSchema>;

    private constructor(file: string) {
        const sqlite = new BetterSqlite3(file);

        sqlite.pragma('foreign_keys = ON');
        sqlite.pragma('journal_mode = WAL');
        sqlite.pragma('busy_timeout = 5000');
        this.connection = new Kysely<DatabaseSchema>({
            dialect: new SqliteDialect({ database: sqlite }),
        });
    }

    static async open(directory: string, existingOnly = false): Promise<Database> {
        const file = join(directory, 'application.sqlite');

        if (existingOnly && !existsSync(file)) {
            throw new Error('No existing application database was found in this data directory.');
        }

        if (!existingOnly) {
            mkdirSync(directory, { recursive: true, mode: 0o700 });
        }

        const database = new Database(file);

        try {
            if (!existingOnly) {
                await database.migrate();
            }

            return database;
        } catch (error) {
            await database.close();
            throw error;
        }
    }

    close(): Promise<void> {
        return this.connection.destroy();
    }

    private async migrate(): Promise<void> {
        const migrator = new Migrator({
            db: this.connection,
            provider: {
                getMigrations: async () => ({
                    '001-foundation': {
                        up: async (db: Kysely<unknown>) => {
                            await db.schema
                                .createTable('users')
                                .addColumn('id', 'text', (c) => c.primaryKey())
                                .addColumn('username', 'text', (c) => c.notNull().unique())
                                .addColumn('role', 'text', (c) => c.notNull())
                                .addColumn('password_hash', 'text', (c) => c.notNull())
                                .addColumn('must_change_password', 'integer', (c) => c.notNull())
                                .addColumn('token_version', 'integer', (c) => c.notNull())
                                .addColumn('created_at', 'text', (c) => c.notNull())
                                .execute();
                            await db.schema
                                .createTable('notes')
                                .addColumn('id', 'text', (c) => c.primaryKey())
                                .addColumn('owner_id', 'text', (c) =>
                                    c.notNull().references('users.id').onDelete('cascade'),
                                )
                                .addColumn('title', 'text', (c) => c.notNull())
                                .addColumn('body', 'text', (c) => c.notNull())
                                .addColumn('created_at', 'text', (c) => c.notNull())
                                .addColumn('updated_at', 'text', (c) => c.notNull())
                                .execute();
                            await db.schema
                                .createIndex('notes_owner')
                                .on('notes')
                                .columns(['owner_id', 'updated_at'])
                                .execute();
                            await db.schema
                                .createTable('server_settings')
                                .addColumn('name', 'text', (c) => c.primaryKey())
                                .addColumn('value', 'text', (c) => c.notNull())
                                .execute();
                        },
                    },
                }),
            },
        });
        const { error } = await migrator.migrateToLatest();

        if (error) {
            throw error;
        }
    }
}
