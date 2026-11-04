import BetterSqlite3 from 'better-sqlite3';
import type { Generated } from 'kysely';
import { Kysely, sql, SqliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseConnections } from './database-connections.adapter.js';

interface UsersTable {
    id: string;
    username: string;
    role: string;
    password_hash: string;
    must_change_password: number;
    token_version: number;
    created_at: string;
    language: string | null;
    active: number;
}

interface AuditLogsTable {
    id: Generated<number>;
    operation_id: string;
    category: string;
    outcome: string;
    actor_id: string | null;
    occurred_at: string;
    subject_type: string;
    subject_id: string | null;
    before_values: string | null;
    after_values: string | null;
    failure: string | null;
}

interface SettingsTable {
    name: string;
    value: string;
}

export interface DatabaseSchema {
    users: UsersTable;
    server_settings: SettingsTable;
    audit_logs: AuditLogsTable;
}

export class Database {
    readonly connection: Kysely<DatabaseSchema>;
    // Repositories use this to join the transaction of the operation in progress.
    readonly connections: DatabaseConnections;

    private constructor(file: string) {
        const sqlite = new BetterSqlite3(file);

        sqlite.pragma('foreign_keys = ON');
        sqlite.pragma('journal_mode = WAL');
        sqlite.pragma('busy_timeout = 5000');
        this.connection = new Kysely<DatabaseSchema>({
            dialect: new SqliteDialect({ database: sqlite }),
        });
        this.connections = new DatabaseConnections(this.connection);
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
                    // Media Collection: removes the foundation Notes demo and adds the personal
                    // interface language (null until the user chooses one).
                    '002-media-collection-foundation': {
                        up: async (db: Kysely<unknown>) => {
                            await db.schema.dropIndex('notes_owner').ifExists().execute();
                            await db.schema.dropTable('notes').ifExists().execute();
                            await db.schema
                                .alterTable('users')
                                .addColumn('language', 'text')
                                .execute();
                        },
                    },
                    // Fixed Admin/Owner/Guest roles with exactly one protected administrator (the
                    // earliest existing one), account deactivation, and the technical audit log.
                    '003-access-and-audit': {
                        up: async (db: Kysely<unknown>) => {
                            await sql`update users set role = 'owner' where role = 'user'`.execute(
                                db,
                            );
                            await sql`update users set role = 'owner' where role = 'admin' and id <> (
                                select id from users where role = 'admin' order by created_at, id limit 1
                            )`.execute(db);
                            await db.schema
                                .alterTable('users')
                                .addColumn('active', 'integer', (c) => c.notNull().defaultTo(1))
                                .execute();
                            await sql`create unique index users_single_administrator on users (role)
                                where role = 'admin'`.execute(db);
                            await db.schema
                                .createTable('audit_logs')
                                .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
                                .addColumn('operation_id', 'text', (c) => c.notNull())
                                .addColumn('category', 'text', (c) => c.notNull())
                                .addColumn('outcome', 'text', (c) => c.notNull())
                                .addColumn('actor_id', 'text', (c) => c.references('users.id'))
                                .addColumn('occurred_at', 'text', (c) => c.notNull())
                                .addColumn('subject_type', 'text', (c) => c.notNull())
                                .addColumn('subject_id', 'text')
                                .addColumn('before_values', 'text')
                                .addColumn('after_values', 'text')
                                .addColumn('failure', 'text')
                                .execute();
                            await db.schema
                                .createIndex('audit_logs_occurred')
                                .on('audit_logs')
                                .columns(['occurred_at', 'id'])
                                .execute();
                            await db.schema
                                .createIndex('audit_logs_operation')
                                .on('audit_logs')
                                .column('operation_id')
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
