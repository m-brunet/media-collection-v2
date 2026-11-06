import type { IdGenerator } from '../../../../application/ports/driven/id-generator.interface.js';
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

interface CollectionsTable {
    id: string;
    name: string;
    name_key: string;
    includes_volume_zero: number;
    finished: number;
    created_at: string;
    updated_at: string;
}

interface CollectionBooksTable {
    book_id: string;
    collection_id: string;
    volume_from: number;
    volume_to: number;
}

interface BookcasesTable {
    id: string;
    name: string;
    name_key: string;
    created_at: string;
    updated_at: string;
}

interface ShelvesTable {
    id: string;
    bookcase_id: string;
    name: string;
    name_key: string;
    created_at: string;
    updated_at: string;
}

interface BookShelvesTable {
    book_id: string;
    shelf_id: string;
}

interface TagsTable {
    id: string;
    name: string;
    name_key: string;
    created_at: string;
    updated_at: string;
}

interface BookTagsTable {
    book_id: string;
    tag_id: string;
}

interface ReceiversTable {
    id: string;
    name: string;
    name_key: string;
    created_at: string;
}

interface LoansTable {
    id: string;
    book_id: string | null;
    receiver_id: string;
    status: string;
    lent_at: string;
    returned_at: string | null;
    book_title: string;
    book_isbn: string | null;
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
    collections: CollectionsTable;
    collection_books: CollectionBooksTable;
    bookcases: BookcasesTable;
    shelves: ShelvesTable;
    book_shelves: BookShelvesTable;
    tags: TagsTable;
    book_tags: BookTagsTable;
    receivers: ReceiversTable;
    loans: LoansTable;
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

    // Creates the database when needed and brings its schema up to date. Migrations that
    // assign new identities use the application's ID generator.
    static async open(directory: string, ids: IdGenerator): Promise<Database> {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        const database = new Database(join(directory, 'application.sqlite'));

        try {
            await database.migrate(ids);

            return database;
        } catch (error) {
            await database.close();
            throw error;
        }
    }

    // Existing storage only, never migrated: used by local administrator recovery.
    static openExisting(directory: string): Database {
        const file = join(directory, 'application.sqlite');

        if (!existsSync(file)) {
            throw new Error('No existing application database was found in this data directory.');
        }

        return new Database(file);
    }

    close(): Promise<void> {
        return this.connection.destroy();
    }

    private async migrate(ids: IdGenerator): Promise<void> {
        const migrator = new Migrator({
            db: this.connection,
            provider: new DatabaseMigrations(ids),
        });
        const { error } = await migrator.migrateToLatest();

        if (error) {
            throw error;
        }
    }
}
