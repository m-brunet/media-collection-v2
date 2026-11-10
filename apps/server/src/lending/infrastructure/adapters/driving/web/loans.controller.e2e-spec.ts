import {
    TestLibrary,
    type BookFacts,
} from '../../../../../../../../tests/api/fixtures/test-library.js';
import { LendingArrangement } from '../../../../../../../../tests/api/fixtures/lending-arrangement.js';
import type {
    LendingDto,
    ReceiverLoansDto,
    ReturnDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from '../../../../../../../../tests/api/setup/test-app.js';
import { UserFixture } from '../../../../../../../../tests/api/fixtures/user.fixture.js';

let app: TestApp;
let arrangement: LendingArrangement;
const owner = new UserFixture({ username: 'camille', role: 'owner' });
const administrator = new UserFixture({ username: 'alex', role: 'admin' });
const guest = new UserFixture({ username: 'morgan', role: 'guest' });

beforeEach(async () => {
    app = new TestApp();
    await app.setup();
    await app.loadFixtures([owner, administrator, guest]);
    arrangement = new LendingArrangement(app.dependencies);
});
afterEach(async () => {
    await app?.teardown();
});

async function book(title: string, facts: BookFacts = {}) {
    const saved = await app.dependencies.builders.book({ title, ...facts });

    return { ...TestLibrary.lendable(saved), updatedAt: saved.snapshot.updatedAt };
}

async function lend(...args: Parameters<LendingArrangement['lend']>) {
    return arrangement.lend(...args);
}

async function giveBack(...loanIds: string[]) {
    await arrangement.giveBack(...loanIds);
}

describe('GET /api/loans', () => {
    it('shows a Guest the lent books grouped by receiver, with their lending dates', async () => {
        const piranesi = await book('Piranesi', {
            authors: ['Susanna Clarke'],
            isbn: '9781635575637',
            publisher: 'Bloomsbury',
            publicationYear: 2020,
        });
        const dune = await book('Dune');
        const sweetgrass = await book('Braiding Sweetgrass');
        const toSam = await lend({ name: 'Sam Taylor' }, dune);

        app.advance(60_000);
        const later = await lend({ id: toSam.receiver.id }, piranesi);
        const toAlexandra = await lend({ name: 'Alexandra Montgomery-Worthington' }, sweetgrass);
        const client = await app.authenticatedClient(guest);

        const response = await client.call<ReceiverLoansDto[]>('/loans');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            {
                receiver: toAlexandra.receiver,
                loans: [
                    expect.objectContaining({
                        book: expect.objectContaining({ title: 'Braiding Sweetgrass' }),
                    }),
                ],
            },
            {
                receiver: { id: toSam.receiver.id, name: 'Sam Taylor' },
                loans: [
                    {
                        loanId: later.loans[0]!.loanId,
                        lentAt: later.loans[0]!.lentAt,
                        book: {
                            id: piranesi.id,
                            title: 'Piranesi',
                            authors: ['Susanna Clarke'],
                            publisher: 'Bloomsbury',
                            publicationYear: 2020,
                            isbn: '9781635575637',
                            hasCover: false,
                            updatedAt: piranesi.updatedAt,
                        },
                    },
                    expect.objectContaining({ loanId: toSam.loans[0]!.loanId }),
                ],
            },
        ]);
    });
    it('finds loans by part of the receiver name', async () => {
        await lend({ name: 'Sam Taylor' }, await book('Dune'));
        await lend({ name: 'Morgan' }, await book('Piranesi'));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReceiverLoansDto[]>('/loans?search=TAYL');

        expect(response.body.map((group) => group.receiver.name)).toEqual(['Sam Taylor']);
    });
    it('finds loans by part of the book title', async () => {
        await lend({ name: 'Sam Taylor' }, await book('Dune'), await book('Piranesi'));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReceiverLoansDto[]>('/loans?search=piran');

        expect(
            response.body.flatMap((group) => group.loans.map((loan) => loan.book.title)),
        ).toEqual(['Piranesi']);
    });
    it('does not search authors', async () => {
        await lend({ name: 'Sam Taylor' }, await book('Dune', { authors: ['Frank Herbert'] }));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReceiverLoansDto[]>('/loans?search=Herbert');

        expect(response.body).toEqual([]);
    });
    it('narrows to one receiver', async () => {
        const sam = await lend({ name: 'Sam Taylor' }, await book('Dune'));

        await lend({ name: 'Morgan' }, await book('Piranesi'));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReceiverLoansDto[]>(
            '/loans?receiver=' + sam.receiver.id,
        );

        expect(response.body.map((group) => group.receiver.id)).toEqual([sam.receiver.id]);
    });
    it('leaves out returned books', async () => {
        const lent = await lend({ name: 'Sam Taylor' }, await book('Dune'));

        await giveBack(lent.loans[0]!.loanId);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReceiverLoansDto[]>('/loans');

        expect(response.body).toEqual([]);
    });
    it('refuses a malformed receiver identity', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans?receiver=sam');

        expect(response.status).toBe(400);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/loans');

        expect(response.status).toBe(401);
    });
});

describe('POST /api/loans', () => {
    it('lends the starting book alone to a new receiver', async () => {
        const piranesi = await book('Piranesi');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<LendingDto>('/loans', 'POST', {
            receiver: { name: ' Sam Taylor ' },
            bookIds: [piranesi.id],
        });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            receiver: { id: expect.any(String), name: 'Sam Taylor' },
            loans: [
                { loanId: expect.any(String), bookId: piranesi.id, lentAt: expect.any(String) },
            ],
        });
        expect(await app.dependencies.library.loans()).toEqual([
            expect.objectContaining({
                bookId: piranesi.id,
                receiverName: 'Sam Taylor',
                status: 'lent',
            }),
        ]);
    });
    it('lends every selected book, recording one entry per book under one operation', async () => {
        const piranesi = await book('Piranesi');
        const dune = await book('Dune');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<LendingDto>('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi.id, dune.id],
        });

        const entries = (await app.dependencies.audit.entries()).filter((entry) =>
            ['loan.lent', 'receiver.created'].includes(entry.category),
        );

        expect(response.body.loans.map((loan) => loan.bookId)).toEqual([piranesi.id, dune.id]);
        expect(entries.map((entry) => [entry.category, entry.subjectId, entry.outcome])).toEqual([
            ['loan.lent', piranesi.id, 'successful'],
            ['loan.lent', dune.id, 'successful'],
            ['receiver.created', response.body.receiver.id, 'successful'],
        ]);
        expect(new Set(entries.map((entry) => entry.operationId)).size).toBe(1);
        expect(entries[0]).toMatchObject({
            actorId: owner.id,
            after: {
                loan: expect.objectContaining({
                    title: 'Piranesi',
                    receiver: { id: response.body.receiver.id, name: 'Sam Taylor' },
                    status: 'lent',
                }),
            },
        });
    });
    it('lets the administrator lend', async () => {
        const dune = await book('Dune');
        const client = await app.authenticatedClient(administrator);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [dune.id],
        });

        expect(response.status).toBe(201);
    });
    it('reuses the receiver with an equivalent name', async () => {
        const first = await lend({ name: 'Zoé Martin' }, await book('Dune'));
        const piranesi = await book('Piranesi');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<LendingDto>('/loans', 'POST', {
            receiver: { name: 'zoe MARTIN' },
            bookIds: [piranesi.id],
        });

        expect(response.body.receiver).toEqual(first.receiver);
        expect(await app.dependencies.library.receivers()).toEqual(['Zoé Martin']);
    });
    it('asks before creating a receiver with a similar name, lending nothing', async () => {
        const sam = await lend({ name: 'Sam Taylor' }, await book('Dune'));
        const piranesi = await book('Piranesi');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Tayler' },
            bookIds: [piranesi.id],
        });

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'receiver-similar',
            details: { name: 'Sam Tayler', candidates: [sam.receiver] },
        });
        expect(await app.dependencies.library.loans()).toHaveLength(1);
    });
    it('creates a distinct receiver once the person confirms a similar name is someone else', async () => {
        await lend({ name: 'Sam Taylor' }, await book('Dune'));
        const piranesi = await book('Piranesi');
        const client = await app.authenticatedClient(owner);

        const response = await client.call<LendingDto>('/loans', 'POST', {
            receiver: { name: 'Sam Tayler', distinct: true },
            bookIds: [piranesi.id],
        });

        expect(response.status).toBe(201);
        expect(await app.dependencies.library.receivers()).toEqual(['Sam Tayler', 'Sam Taylor']);
    });
    it('refuses a Not Owned book, lending nothing and creating no receiver', async () => {
        const piranesi = await book('Piranesi');
        const planned = await book('Children of Dune', { planned: true });
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi.id, planned.id],
        });

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'book-not-owned',
            details: { bookIds: [planned.id] },
        });
        expect(await app.dependencies.library.loans()).toEqual([]);
        expect(await app.dependencies.library.receivers()).toEqual([]);
    });
    it('refuses a book already lent, lending none of the selection', async () => {
        const dune = await book('Dune');
        const piranesi = await book('Piranesi');

        await lend({ name: 'Morgan' }, dune);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi.id, dune.id],
        });

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'book-already-lent',
            details: { bookIds: [dune.id], lentTo: { [dune.id]: 'Morgan' } },
        });
        expect((await app.dependencies.library.loans()).map((loan) => loan.bookId)).toEqual([
            dune.id,
        ]);
        expect(await app.dependencies.library.receivers()).toEqual(['Morgan']);
    });
    it('keeps a Failed record for every selected book of a refused lending', async () => {
        const dune = await book('Dune');
        const planned = await book('Children of Dune', { planned: true });
        const client = await app.authenticatedClient(owner);

        await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [dune.id, planned.id],
        });

        const failed = (await app.dependencies.audit.entries()).filter(
            (entry) => entry.category === 'loan.lent',
        );

        expect(failed.map((entry) => [entry.subjectId, entry.outcome, entry.after])).toEqual([
            [dune.id, 'failed', null],
            [planned.id, 'failed', null],
        ]);
        expect(new Set(failed.map((entry) => entry.operationId)).size).toBe(1);
    });
    it('refuses an empty selection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [],
        });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('selection-empty');
    });
    it('refuses a book selected twice', async () => {
        const dune = await book('Dune');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [dune.id, dune.id],
        });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('selection-duplicate');
    });
    it('refuses a blank receiver name', async () => {
        const dune = await book('Dune');
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: '  ' },
            bookIds: [dune.id],
        });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('receiver-name-invalid');
    });
    it('refuses a book that does not exist', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: ['5b0ae0a6-8f0a-4b8f-9d58-9c6e1f9d2b11'],
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('book-missing');
    });
    it('refuses a malformed request', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: ['dune'],
        });

        expect(response.status).toBe(400);
    });
    it('refuses a Guest', async () => {
        const dune = await book('Dune');
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [dune.id],
        });

        expect(response.status).toBe(403);
        expect(response.body.reason).toBe('guest-read-only');
        expect(await app.dependencies.library.loans()).toEqual([]);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/loans', 'POST', {
            receiver: { name: 'Sam Taylor' },
            bookIds: [],
        });

        expect(response.status).toBe(401);
    });
});

describe('POST /api/loans/returns', () => {
    it('returns the selected book and leaves the other books of the receiver lent', async () => {
        const piranesi = await book('Piranesi');
        const dune = await book('Dune');
        const lent = await lend({ name: 'Sam Taylor' }, piranesi, dune);
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReturnDto>('/loans/returns', 'POST', {
            loanIds: [lent.loans[1]!.loanId],
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            receiver: lent.receiver,
            returned: [
                { loanId: lent.loans[1]!.loanId, bookId: dune.id, returnedAt: expect.any(String) },
            ],
        });
        expect(
            (await app.dependencies.library.loans()).map((loan) => [loan.bookTitle, loan.status]),
        ).toEqual([
            ['Dune', 'returned'],
            ['Piranesi', 'lent'],
        ]);
    });
    it('returns books of the receiver lent on separate occasions together', async () => {
        const first = await lend({ name: 'Sam Taylor' }, await book('Dune'));

        app.advance(60_000);
        const second = await lend({ id: first.receiver.id }, await book('Piranesi'));
        const client = await app.authenticatedClient(owner);

        const response = await client.call<ReturnDto>('/loans/returns', 'POST', {
            loanIds: [first.loans[0]!.loanId, second.loans[0]!.loanId],
        });

        expect(response.body.returned).toHaveLength(2);
        expect((await app.dependencies.library.loans()).map((loan) => loan.status)).toEqual([
            'returned',
            'returned',
        ]);
    });
    it('records one entry per returned loan under one operation', async () => {
        const lent = await lend({ name: 'Sam Taylor' }, await book('Dune'), await book('Piranesi'));
        const client = await app.authenticatedClient(owner);

        await client.call('/loans/returns', 'POST', {
            loanIds: lent.loans.map((loan) => loan.loanId),
        });

        const entries = (await app.dependencies.audit.entries()).filter(
            (entry) => entry.category === 'loan.returned',
        );

        expect(entries.map((entry) => [entry.subjectType, entry.subjectId, entry.outcome])).toEqual(
            lent.loans.map((loan) => ['loan', loan.loanId, 'successful']),
        );
        expect(new Set(entries.map((entry) => entry.operationId)).size).toBe(1);
        expect(entries[0]).toMatchObject({
            before: { loan: expect.objectContaining({ status: 'lent' }) },
            after: { loan: expect.objectContaining({ status: 'returned' }) },
        });
    });
    it('refuses loans of different receivers, returning none', async () => {
        const toSam = await lend({ name: 'Sam Taylor' }, await book('Dune'));
        const toMorgan = await lend({ name: 'Morgan' }, await book('Piranesi'));
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans/returns', 'POST', {
            loanIds: [toSam.loans[0]!.loanId, toMorgan.loans[0]!.loanId],
        });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('loans-different-receivers');
        expect((await app.dependencies.library.loans()).map((loan) => loan.status)).toEqual([
            'lent',
            'lent',
        ]);
    });
    it('refuses a loan already returned by another account, returning none of the selection', async () => {
        const lent = await lend({ name: 'Sam Taylor' }, await book('Dune'), await book('Piranesi'));

        await giveBack(lent.loans[0]!.loanId);
        const client = await app.authenticatedClient(administrator);

        const response = await client.call('/loans/returns', 'POST', {
            loanIds: lent.loans.map((loan) => loan.loanId),
        });

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
            reason: 'loan-already-returned',
            details: { loanIds: [lent.loans[0]!.loanId] },
        });
        expect(
            (await app.dependencies.library.loans()).map((loan) => [loan.bookTitle, loan.status]),
        ).toEqual([
            ['Dune', 'returned'],
            ['Piranesi', 'lent'],
        ]);
    });
    it('keeps the completed loan when the book is lent again', async () => {
        const dune = await book('Dune');
        const first = await lend({ name: 'Sam Taylor' }, dune);

        await giveBack(first.loans[0]!.loanId);
        app.advance(60_000);
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans', 'POST', {
            receiver: { id: first.receiver.id },
            bookIds: [dune.id],
        });

        expect(response.status).toBe(201);
        expect((await app.dependencies.library.loans()).map((loan) => loan.status)).toEqual([
            'returned',
            'lent',
        ]);
    });
    it('refuses a loan that does not exist', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans/returns', 'POST', {
            loanIds: ['5b0ae0a6-8f0a-4b8f-9d58-9c6e1f9d2b11'],
        });

        expect(response.status).toBe(404);
        expect(response.body.reason).toBe('loan-missing');
    });
    it('refuses an empty selection', async () => {
        const client = await app.authenticatedClient(owner);

        const response = await client.call('/loans/returns', 'POST', { loanIds: [] });

        expect(response.status).toBe(400);
        expect(response.body.reason).toBe('selection-empty');
    });
    it('refuses a Guest', async () => {
        const lent = await lend({ name: 'Sam Taylor' }, await book('Dune'));
        const client = await app.authenticatedClient(guest);

        const response = await client.call('/loans/returns', 'POST', {
            loanIds: [lent.loans[0]!.loanId],
        });

        expect(response.status).toBe(403);
        expect(response.body.reason).toBe('guest-read-only');
        expect((await app.dependencies.library.loans()).map((loan) => loan.status)).toEqual([
            'lent',
        ]);
    });
    it('requires a signed-in account', async () => {
        const client = app.client();

        await client.prepare();

        const response = await client.call('/loans/returns', 'POST', { loanIds: [] });

        expect(response.status).toBe(401);
    });
});
