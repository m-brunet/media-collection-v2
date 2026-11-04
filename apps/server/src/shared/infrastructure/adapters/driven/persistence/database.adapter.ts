import { DatabaseMigrations } from './database-migrations.adapter.js';
import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
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
    id: string;
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
    id: string;
    name: string;
    value: string;
}

interface AuthorsTable {
    id: string;
    name: string;
    name_key: string;
    created_at: string;
}

interface BooksTable {
    id: string;
    title: string;
    title_key: string;
    isbn13: string | null;
    isbn_converted: number;
    no_isbn: number;
    category: string;
    ownership: string;
    publisher: string | null;
    publication_year: number | null;
    publication_month: number | null;
    summary: string | null;
    page_count: number | null;
    price_cents: number | null;
    cover_file: string | null;
    created_at: string;
    updated_at: string;
}

interface BookAuthorsTable {
    book_id: string;
    author_id: string;
    position: number;
}

interface ReadingStatusesTable {
    user_id: string;
    book_id: string;
    read: number;
}

interface PersonalNotesTable {
    user_id: string;
    book_id: string;
    text: string;
    updated_at: string;
}

export interface DatabaseSchema {
    users: UsersTable;
    server_settings: SettingsTable;
    audit_logs: AuditLogsTable;
    authors: AuthorsTable;
    books: BooksTable;
    book_authors: BookAuthorsTable;
    reading_statuses: ReadingStatusesTable;
    personal_notes: PersonalNotesTable;
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
            provider: new DatabaseMigrations(),
        });
        const { error } = await migrator.migrateToLatest();

        if (error) {
            throw error;
        }
    }
}
