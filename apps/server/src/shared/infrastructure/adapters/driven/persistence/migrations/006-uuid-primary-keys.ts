import type { IdGenerator } from '../../../../../application/ports/driven/id-generator.interface.js';
import { Kysely, sql } from 'kysely';
import type { Migration } from 'kysely/migration';
import { Required } from '../../../../../domain/required.helper.js';

interface TableSnapshot {
    name: string;
    definition: string;
    rows: Record<string, unknown>[];
}

export class UuidPrimaryKeysMigration implements Migration {
    private static readonly uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    private static readonly tables = [
        'users',
        'server_settings',
        'authors',
        'books',
        'audit_logs',
        'book_authors',
        'reading_statuses',
        'personal_notes',
    ];

    constructor(private readonly ids: IdGenerator) {}

    async up(db: Kysely<unknown>): Promise<void> {
        // The SQLite migrator does not supply a transaction. A completed rebuild may
        // be retried if the process stops before Kysely records the migration name.
        await db.transaction().execute((transaction) => this.rebuild(transaction));
    }

    private async rebuild(db: Kysely<unknown>): Promise<void> {
        const completed = await sql<{ sql: string }>`select sql from sqlite_master
            where type = 'table' and name in ('users', 'authors', 'books', 'audit_logs', 'server_settings')`.execute(
            db,
        );

        if (
            completed.rows.length === 5 &&
            completed.rows.every((row) => row.sql.includes(UuidPrimaryKeysMigration.uuidCheck()))
        ) {
            return;
        }

        const snapshots: TableSnapshot[] = [];
        const indexes = await sql<{ sql: string }>`select sql from sqlite_master
            where type = 'index' and sql is not null and tbl_name in
            (${sql.join(UuidPrimaryKeysMigration.tables)})`.execute(db);

        for (const name of UuidPrimaryKeysMigration.tables) {
            const schema = await sql<{ sql: string }>`select sql from sqlite_master
                where type = 'table' and name = ${name}`.execute(db);
            const rows = await sql<
                Record<string, unknown>
            >`select * from ${sql.table(name)}`.execute(db);

            if (['users', 'authors', 'books'].includes(name)) {
                for (const row of rows.rows) {
                    if (typeof row.id !== 'string' || !UuidPrimaryKeysMigration.uuid.test(row.id)) {
                        throw new Error(
                            `Cannot migrate ${name}: a non-UUID primary key exists. Repair the data before retrying.`,
                        );
                    }
                }
            }

            snapshots.push({
                name,
                definition: Required.at(schema.rows, 0, `${name} has a table definition`).sql,
                rows: rows.rows,
            });
        }

        for (const { name } of [...snapshots].reverse()) {
            await db.schema.dropTable(name).execute();
        }

        for (const snapshot of snapshots) {
            await sql.raw(this.definition(snapshot)).execute(db);

            for (const saved of snapshot.rows) {
                const row = { ...saved };

                if (snapshot.name === 'audit_logs' || snapshot.name === 'server_settings') {
                    row.id = this.ids.next();
                }

                await sql`insert into ${sql.table(snapshot.name)}
                    (${sql.join(Object.keys(row).map((key) => sql.ref(key)))})
                    values (${sql.join(Object.values(row))})`.execute(db);
            }
        }

        for (const index of indexes.rows) {
            await sql.raw(index.sql).execute(db);
        }

        const violations = await sql`pragma foreign_key_check`.execute(db);

        if (violations.rows.length > 0) {
            throw new Error('UUID migration failed its foreign-key integrity check.');
        }
    }

    private definition(snapshot: TableSnapshot): string {
        const id = `"id" text not null primary key check (${UuidPrimaryKeysMigration.uuidCheck()})`;

        if (snapshot.name === 'server_settings') {
            const definition = snapshot.definition.replace(
                /"?name"?\s+text\s+primary key/i,
                `${id}, "name" text not null unique`,
            );

            if (definition === snapshot.definition) {
                throw new Error('Unexpected primary-key definition in server_settings.');
            }

            return definition;
        }

        if (['users', 'authors', 'books', 'audit_logs'].includes(snapshot.name)) {
            const definition = snapshot.definition.replace(
                /"?id"?\s+(?:integer\s+primary key\s+autoincrement|text\s+primary key)/i,
                id,
            );

            if (definition === snapshot.definition) {
                throw new Error(`Unexpected primary-key definition in ${snapshot.name}.`);
            }

            return definition;
        }

        return snapshot.definition;
    }

    static uuidCheck(): string {
        return `typeof(id) = 'text' and length(id) = 36
            and substr(id, 9, 1) = '-' and substr(id, 14, 1) = '-'
            and substr(id, 19, 1) = '-' and substr(id, 24, 1) = '-'
            and length(replace(id, '-', '')) = 32
            and lower(replace(id, '-', '')) not glob '*[^0-9a-f]*'
            and substr(id, 15, 1) glob '[1-8]'
            and lower(substr(id, 20, 1)) glob '[89ab]'`;
    }
}
