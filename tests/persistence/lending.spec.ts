import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { Loan } from '../../apps/server/src/lending/domain/entities/loan.entity.js';
import { Receiver } from '../../apps/server/src/lending/domain/entities/receiver.entity.js';
import { KyselyActiveLoans } from '../../apps/server/src/lending/infrastructure/adapters/driven/persistence/kysely-active-loans.adapter.js';
import { KyselyLendableBooks } from '../../apps/server/src/lending/infrastructure/adapters/driven/persistence/kysely-lendable-books.adapter.js';
import { KyselyLoanRepository } from '../../apps/server/src/lending/infrastructure/adapters/driven/persistence/kysely-loan.repository.js';
import { KyselyReceiverRepository } from '../../apps/server/src/lending/infrastructure/adapters/driven/persistence/kysely-receiver.repository.js';
import { NameKey } from '../../apps/server/src/shared/domain/name-key.helper.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { DatabaseMigrations } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database-migrations.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';

const now = '2026-01-01T00:00:00.000Z';
const paths: string[] = [];
const databases: Database[] = [];
const connections: Kysely<unknown>[] = [];

afterEach(async () => {
    try {
        for (const database of databases.splice(0)) {
            await database.close();
        }

        for (const db of connections.splice(0)) {
            await db.destroy();
        }
    } finally {
        for (const path of paths.splice(0)) {
            await rm(path, { recursive: true, force: true });
        }
    }
});

interface BookRow {
    title: string;
    ownership?: string;
    isbn13?: string | null;
    publisher?: string | null;
    year?: number | null;
    cover?: string | null;
    authors?: string[];
}

// A migrated library whose rows are written directly, to exercise the lending tables and adapters.
async function library() {
    const path = await mkdtemp(join(tmpdir(), 'lending-'));

    paths.push(path);
    const database = await Database.open(path, new UuidGenerator());

    databases.push(database);
    const db = database.connection;
    const loans = new KyselyLoanRepository(database.connections);
    const receivers = new KyselyReceiverRepository(database.connections);

    const book = async (row: BookRow) => {
        const id = randomUUID();

        await db
            .insertInto('books')
            .values({
                id,
                title: row.title,
                title_key: NameKey.of(row.title),
                isbn13: row.isbn13 ?? null,
                isbn_converted: 0,
                no_isbn: row.isbn13 ? 0 : 1,
                category: 'books',
                ownership: row.ownership ?? 'owned',
                publisher: row.publisher ?? null,
                publication_year: row.year ?? null,
                publication_month: null,
                summary: null,
                page_count: null,
                price_cents: null,
                cover_file: row.cover ?? null,
                created_at: now,
                updated_at: now,
            })
            .execute();

        for (const [position, name] of (row.authors ?? []).entries()) {
            const authorId = randomUUID();

            await db
                .insertInto('authors')
                .values({ id: authorId, name, name_key: NameKey.of(name), created_at: now })
                .execute();

            await db
                .insertInto('book_authors')
                .values({ book_id: id, author_id: authorId, position })
                .execute();
        }

        return id;
    };

    const receiver = async (name: string) => {
        const created = new Receiver({ id: randomUUID(), name, createdAt: now });

        await receivers.create(created);

        return created.id;
    };

    const lend = async (bookId: string, receiverId: string, lentAt = now) => {
        const loan = Loan.lend({
            id: randomUUID(),
            book: { id: bookId, title: 'Any', isbn: null, ownership: 'owned', lentTo: null },
            receiverId,
            now: lentAt,
        });

        await loans.create(loan);

        return loan;
    };

    const giveBack = async (loan: Loan) => {
        Loan.returnTogether([loan], '2026-02-01T00:00:00.000Z');
        await loans.save(loan);
    };

    return { database, db, loans, receivers, book, receiver, lend, giveBack };
}

async function migratedTo(target: string) {
    const path = await mkdtemp(join(tmpdir(), 'lending-upgrade-'));

    paths.push(path);
    const sqlite = new BetterSqlite3(join(path, 'application.sqlite'));

    sqlite.pragma('foreign_keys = ON');
    const db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: sqlite }) });

    connections.push(db);
    const migrator = new Migrator({ db, provider: new DatabaseMigrations(new UuidGenerator()) });
    const result = await migrator.migrateTo(target);

    if (result.error) {
        throw result.error;
    }

    return { db, migrator };
}

describe('lending tables', () => {
    it('rejects non-UUID receiver identities', async () => {
        const { db } = await library();

        const result = sql`insert into receivers values ('x', 'Sam', 'sam', ${now})`.execute(db);

        await expect(result).rejects.toThrow(/CHECK constraint/);
    });
    it('rejects non-UUID loan identities', async () => {
        const { db, book, receiver } = await library();
        const dune = await book({ title: 'Dune' });
        const sam = await receiver('Sam');

        const result = sql`insert into loans values ('x', ${dune}, ${sam}, 'lent', ${now}, null,
            'Dune', null)`.execute(db);

        await expect(result).rejects.toThrow(/CHECK constraint/);
    });
    it('keeps receiver names unique by their comparison key', async () => {
        const { receiver } = await library();

        await receiver('Sam Taylor');

        const result = receiver('sam taylor');

        await expect(result).rejects.toThrow(/UNIQUE constraint/);
    });
    it('refuses a second active loan of the same book', async () => {
        const { book, receiver, lend } = await library();
        const dune = await book({ title: 'Dune' });
        const sam = await receiver('Sam');
        const morgan = await receiver('Morgan');

        await lend(dune, sam);

        const result = lend(dune, morgan);

        await expect(result).rejects.toThrow(
            expect.objectContaining({ code: 'conflict', reason: 'book-already-lent' }),
        );
    });
    it('records a new occurrence when a returned book is lent again, keeping the first', async () => {
        const { db, book, receiver, lend, giveBack } = await library();
        const dune = await book({ title: 'Dune' });
        const sam = await receiver('Sam');
        const first = await lend(dune, sam);

        await giveBack(first);

        await lend(dune, sam, '2026-03-01T00:00:00.000Z');

        expect(
            await db.selectFrom('loans').select(['status', 'lent_at']).orderBy('lent_at').execute(),
        ).toEqual([
            { status: 'returned', lent_at: now },
            { status: 'lent', lent_at: '2026-03-01T00:00:00.000Z' },
        ]);
    });
    it('refuses an unknown loan status', async () => {
        const { db, book, receiver } = await library();
        const dune = await book({ title: 'Dune' });
        const sam = await receiver('Sam');

        const result = sql`insert into loans values (${randomUUID()}, ${dune}, ${sam}, 'lost',
            ${now}, null, 'Dune', null)`.execute(db);

        await expect(result).rejects.toThrow(/CHECK constraint/);
    });
    it('refuses a returned loan without a return date', async () => {
        const { db, book, receiver } = await library();
        const dune = await book({ title: 'Dune' });
        const sam = await receiver('Sam');

        const result = sql`insert into loans values (${randomUUID()}, ${dune}, ${sam}, 'returned',
            ${now}, null, 'Dune', null)`.execute(db);

        await expect(result).rejects.toThrow(/CHECK constraint/);
    });
    it('refuses deleting a book that is lent', async () => {
        const { db, book, receiver, lend } = await library();
        const dune = await book({ title: 'Dune' });

        await lend(dune, await receiver('Sam'));

        const result = db.deleteFrom('books').where('id', '=', dune).execute();

        await expect(result).rejects.toThrow(/constraint/i);
    });
    it('keeps a completed loan of a deleted book, identified by its title and ISBN', async () => {
        const { db, loans, book, receiver, giveBack } = await library();
        const piranesi = await book({ title: 'Piranesi', isbn13: '9781635575637' });
        const loan = Loan.lend({
            id: randomUUID(),
            book: {
                id: piranesi,
                title: 'Piranesi',
                isbn: '9781635575637',
                ownership: 'owned',
                lentTo: null,
            },
            receiverId: await receiver('Sam'),
            now,
        });

        await loans.create(loan);
        await giveBack(loan);

        await db.deleteFrom('books').where('id', '=', piranesi).execute();

        expect((await loans.findByIds([loan.id]))[0]?.snapshot).toMatchObject({
            bookId: null,
            status: 'returned',
            bookTitle: 'Piranesi',
            bookIsbn: '9781635575637',
        });
    });
    it('adds the lending tables to a populated library', async () => {
        const { db, migrator } = await migratedTo('008-locations-and-tags');
        const dune = randomUUID();

        await sql`insert into books (id, title, title_key, isbn13, isbn_converted, no_isbn,
            category, ownership, created_at, updated_at) values (${dune}, 'Dune', 'dune', null, 0,
            1, 'books', 'owned', ${now}, ${now})`.execute(db);

        const result = await migrator.migrateToLatest();

        expect(result.error).toBeUndefined();
        expect((await sql`select id from books`.execute(db)).rows).toEqual([{ id: dune }]);
        expect((await sql`select * from loans`.execute(db)).rows).toEqual([]);
        expect((await sql`select * from receivers`.execute(db)).rows).toEqual([]);
    });
});

describe('KyselyLoanRepository', () => {
    it('finds loans in the requested order and leaves out unknown ones', async () => {
        const { loans, book, receiver, lend } = await library();
        const sam = await receiver('Sam');
        const dune = await lend(await book({ title: 'Dune' }), sam);
        const piranesi = await lend(await book({ title: 'Piranesi' }), sam);

        const result = await loans.findByIds([piranesi.id, randomUUID(), dune.id]);

        expect(result.map((loan) => loan.id)).toEqual([piranesi.id, dune.id]);
    });
    it('saves a return with its date', async () => {
        const { loans, book, receiver, lend } = await library();
        const loan = await lend(await book({ title: 'Dune' }), await receiver('Sam'));

        Loan.returnTogether([loan], '2026-02-01T00:00:00.000Z');

        await loans.save(loan);

        expect((await loans.findByIds([loan.id]))[0]?.snapshot).toMatchObject({
            status: 'returned',
            returnedAt: '2026-02-01T00:00:00.000Z',
        });
    });
    it('names the book in the conflict when it is already lent', async () => {
        const { loans, book, receiver, lend } = await library();
        const dune = await book({ title: 'Dune' });
        const sam = await receiver('Sam');

        await lend(dune, sam);
        const second = Loan.lend({
            id: randomUUID(),
            book: { id: dune, title: 'Dune', isbn: null, ownership: 'owned', lentTo: null },
            receiverId: sam,
            now,
        });

        const result = loans.create(second);

        await expect(result).rejects.toThrow(
            expect.objectContaining({ details: { bookIds: [dune] } }),
        );
    });
});

describe('KyselyReceiverRepository', () => {
    it('finds a receiver by an equivalent name key', async () => {
        const { receivers, receiver } = await library();
        const zoe = await receiver('Zoé Martin');

        const result = await receivers.findByKey(NameKey.of('  ZOE martin'));

        expect(result?.snapshot).toEqual({ id: zoe, name: 'Zoé Martin', createdAt: now });
    });
    it('lists receivers in name order', async () => {
        const { receivers, receiver } = await library();

        await receiver('Sam');
        await receiver('alex');
        await receiver('Morgan');

        const result = await receivers.list();

        expect(result.map((item) => item.snapshot.name)).toEqual(['alex', 'Morgan', 'Sam']);
    });
});

describe('KyselyLendableBooks', () => {
    it('reports ownership and active loans of the requested books, leaving out unknown ones', async () => {
        const { database, book, receiver, lend, giveBack } = await library();
        const owned = await book({ title: 'Dune', isbn13: '9780441013593' });
        const planned = await book({ title: 'Children of Dune', ownership: 'not-owned' });
        const lent = await book({ title: 'Piranesi' });
        const returned = await book({ title: 'Overstory' });
        const sam = await receiver('Sam');

        await lend(lent, sam);
        await giveBack(await lend(returned, sam));
        const lendable = new KyselyLendableBooks(database.connections);

        const result = await lendable.find([lent, owned, randomUUID(), planned, returned]);

        expect(result).toEqual([
            { id: lent, title: 'Piranesi', isbn: null, ownership: 'owned', lentTo: 'Sam' },
            { id: owned, title: 'Dune', isbn: '9780441013593', ownership: 'owned', lentTo: null },
            {
                id: planned,
                title: 'Children of Dune',
                isbn: null,
                ownership: 'not-owned',
                lentTo: null,
            },
            { id: returned, title: 'Overstory', isbn: null, ownership: 'owned', lentTo: null },
        ]);
    });
});

describe('KyselyActiveLoans', () => {
    async function lentLibrary() {
        const context = await library();
        const { book, receiver, lend, giveBack } = context;
        const sam = await receiver('Sam Taylor');
        const alexandra = await receiver('Alexandra Montgomery-Worthington');
        const piranesi = await book({
            title: 'Piranesi',
            isbn13: '9781635575637',
            publisher: 'Bloomsbury',
            year: 2020,
            cover: 'piranesi.jpg',
            authors: ['Susanna Clarke'],
        });
        const dune = await book({ title: 'Dune', authors: ['Frank Herbert'] });
        const sweetgrass = await book({ title: 'Braiding Sweetgrass' });
        const returned = await book({ title: 'The Overstory' });
        const pir = await lend(piranesi, sam, '2026-10-30T09:00:00.000Z');
        const dun = await lend(dune, sam, '2026-10-25T09:00:00.000Z');
        const swe = await lend(sweetgrass, alexandra, '2026-10-22T09:00:00.000Z');

        await giveBack(await lend(returned, sam, '2026-10-01T09:00:00.000Z'));
        const active = new KyselyActiveLoans(context.database.connections);

        return { active, sam, alexandra, piranesi, dune, sweetgrass, pir, dun, swe };
    }

    it('groups active loans by receiver in name order, newest loan first', async () => {
        const { active, sam, alexandra, pir, dun, swe } = await lentLibrary();

        const result = await active.list({ search: null, receiverId: null });

        expect(
            result.map((group) => [group.receiver.id, group.loans.map((l) => l.loanId)]),
        ).toEqual([
            [alexandra, [swe.id]],
            [sam, [pir.id, dun.id]],
        ]);
    });
    it('describes each lent book with its lending date', async () => {
        const { active, sam, piranesi, pir } = await lentLibrary();

        const result = await active.list({ search: null, receiverId: sam });

        expect(result[0]?.loans[0]).toEqual({
            loanId: pir.id,
            lentAt: '2026-10-30T09:00:00.000Z',
            book: {
                id: piranesi,
                title: 'Piranesi',
                authors: ['Susanna Clarke'],
                publisher: 'Bloomsbury',
                publicationYear: 2020,
                isbn: '9781635575637',
                hasCover: true,
                updatedAt: now,
            },
        });
    });
    it('leaves out returned loans', async () => {
        const { active, sam } = await lentLibrary();

        const result = await active.list({ search: null, receiverId: sam });

        expect(result[0]?.loans.map((loan) => loan.book.title)).toEqual(['Piranesi', 'Dune']);
    });
    it('narrows to one receiver', async () => {
        const { active, alexandra } = await lentLibrary();

        const result = await active.list({ search: null, receiverId: alexandra });

        expect(result.map((group) => group.receiver.name)).toEqual([
            'Alexandra Montgomery-Worthington',
        ]);
    });
    it('finds every loan of a receiver by part of their name, ignoring case and accents', async () => {
        const { active, sam } = await lentLibrary();

        const result = await active.list({ search: ' TAYLÖR', receiverId: null });

        expect(result.map((group) => [group.receiver.id, group.loans.length])).toEqual([[sam, 2]]);
    });
    it('finds a loan by part of the book title', async () => {
        const { active, swe } = await lentLibrary();

        const result = await active.list({ search: 'sweet', receiverId: null });

        expect(result.flatMap((group) => group.loans.map((loan) => loan.loanId))).toEqual([swe.id]);
    });
    it('does not search authors', async () => {
        const { active } = await lentLibrary();

        const result = await active.list({ search: 'Herbert', receiverId: null });

        expect(result).toEqual([]);
    });
    it('does not search ISBNs', async () => {
        const { active } = await lentLibrary();

        const result = await active.list({ search: '9781635575637', receiverId: null });

        expect(result).toEqual([]);
    });
    it('returns no group when nothing is lent', async () => {
        const { database } = await library();
        const active = new KyselyActiveLoans(database.connections);

        const result = await active.list({ search: null, receiverId: null });

        expect(result).toEqual([]);
    });
});

describe('KyselyLoanRepository for the books feature', () => {
    it('finds only the active loans of the given books', async () => {
        const { loans, book, receiver, lend, giveBack } = await library();
        const sam = await receiver('Sam');
        const dune = await book({ title: 'Dune' });
        const piranesi = await book({ title: 'Piranesi' });
        const overstory = await book({ title: 'Overstory' });
        const active = await lend(dune, sam);

        await giveBack(await lend(piranesi, sam));
        await lend(overstory, sam);

        const result = await loans.findActiveByBooks([dune, piranesi]);

        expect(result.map((loan) => loan.id)).toEqual([active.id]);
    });
    it('refreshes the title and ISBN copy of every loan of a book', async () => {
        const { loans, book, receiver, lend, giveBack } = await library();
        const dune = await book({ title: 'Dune' });
        const first = await lend(dune, await receiver('Sam'));

        await giveBack(first);

        await loans.keepIdentification({ id: dune, title: 'Dune (Deluxe)', isbn: '9780593099322' });

        expect((await loans.findByIds([first.id]))[0]?.snapshot).toMatchObject({
            bookTitle: 'Dune (Deluxe)',
            bookIsbn: '9780593099322',
        });
    });
});

describe('KyselyReceiverRepository.findByIds', () => {
    it('finds the given receivers and leaves out unknown ones', async () => {
        const { receivers, receiver } = await library();
        const sam = await receiver('Sam');

        await receiver('Morgan');

        const result = await receivers.findByIds([sam, randomUUID()]);

        expect(result.map((item) => item.snapshot.name)).toEqual(['Sam']);
    });
});
