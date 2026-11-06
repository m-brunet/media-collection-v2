import { describe, expect, it } from 'vitest';
import {
    administrator,
    guest,
    lending,
    lent,
    owner,
    receiver,
} from '../testing/lending-doubles.test-support.js';
import { Loan } from '../../domain/entities/loan.entity.js';
import { LendBooks } from './lend-books.usecase.js';

function subject(current: ReturnType<typeof lending>) {
    return new LendBooks(
        current.books,
        current.loans,
        current.resolver,
        current.ids,
        current.clock,
        current.operations,
    );
}

function shelf(current: ReturnType<typeof lending>) {
    return {
        piranesi: current.books.add('piranesi', 'Piranesi'),
        dune: current.books.add('dune', 'Dune'),
        overstory: current.books.add('overstory', 'The Overstory'),
        planned: current.books.add('planned', 'Children of Dune', 'not-owned'),
    };
}

describe('LendBooks', () => {
    it('lends the starting book alone to a new receiver', async () => {
        const current = lending();
        const { piranesi } = shelf(current);

        const result = await subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi],
        });

        expect(result).toEqual({
            receiver: { id: 'id-1', name: 'Sam Taylor' },
            loans: [{ loanId: 'id-2', bookId: 'piranesi', lentAt: '2026-10-30T09:00:00.000Z' }],
        });
        expect(current.loans.of(piranesi).map((loan) => loan.active)).toEqual([true]);
    });
    it('lends every selected book to the receiver', async () => {
        const current = lending();
        const { piranesi, dune, overstory } = shelf(current);

        const result = await subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi, dune, overstory],
        });

        expect(result.loans.map((loan) => loan.bookId)).toEqual([piranesi, dune, overstory]);
        expect(current.loans.loans.size).toBe(3);
    });
    it('lends other books after the starting book was removed from the selection', async () => {
        const current = lending();
        const { dune } = shelf(current);

        const result = await subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [dune],
        });

        expect(result.loans.map((loan) => loan.bookId)).toEqual([dune]);
    });
    it('lets the administrator lend', async () => {
        const current = lending();
        const { piranesi } = shelf(current);

        const result = await subject(current).execute(administrator, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi],
        });

        expect(result.loans).toHaveLength(1);
    });
    it('reuses the existing receiver chosen by the person', async () => {
        const current = lending();
        const { piranesi } = shelf(current);
        const sam = await receiver(current, 'Sam Taylor');

        const result = await subject(current).execute(owner, {
            receiver: { id: sam.id },
            bookIds: [piranesi],
        });

        expect(result.receiver).toEqual({ id: sam.id, name: 'Sam Taylor' });
        expect(current.receivers.receivers.size).toBe(1);
    });
    it('reuses the receiver with an equivalent name', async () => {
        const current = lending();
        const { piranesi } = shelf(current);
        const zoe = await receiver(current, 'Zoé Martin');

        const result = await subject(current).execute(owner, {
            receiver: { name: ' zoe MARTIN ' },
            bookIds: [piranesi],
        });

        expect(result.receiver).toEqual({ id: zoe.id, name: 'Zoé Martin' });
        expect(current.receivers.receivers.size).toBe(1);
    });
    it('asks before creating a receiver with a similar name, lending nothing', async () => {
        const current = lending();
        const { piranesi } = shelf(current);
        const sam = await receiver(current, 'Sam Taylor');

        const result = subject(current).execute(owner, {
            receiver: { name: 'Sam Tayler' },
            bookIds: [piranesi],
        });

        await expect(result).rejects.toMatchObject({
            code: 'conflict',
            reason: 'receiver-similar',
            details: { name: 'Sam Tayler', candidates: [{ id: sam.id, name: 'Sam Taylor' }] },
        });
        expect(current.loans.loans.size).toBe(0);
        expect(current.receivers.receivers.size).toBe(1);
    });
    it('creates a distinct receiver once the person confirms a similar name is someone else', async () => {
        const current = lending();
        const { piranesi } = shelf(current);

        await receiver(current, 'Sam Taylor');

        const result = await subject(current).execute(owner, {
            receiver: { name: 'Sam Tayler', distinct: true },
            bookIds: [piranesi],
        });

        expect(result.receiver.name).toBe('Sam Tayler');
        expect(current.receivers.receivers.size).toBe(2);
    });
    it('still reuses an identical name even when told it is someone else', async () => {
        const current = lending();
        const { piranesi } = shelf(current);
        const sam = await receiver(current, 'Sam Taylor');

        const result = await subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor', distinct: true },
            bookIds: [piranesi],
        });

        expect(result.receiver.id).toBe(sam.id);
        expect(current.receivers.receivers.size).toBe(1);
    });
    it('refuses a blank receiver name', async () => {
        const current = lending();
        const { piranesi } = shelf(current);

        const result = subject(current).execute(owner, {
            receiver: { name: '   ' },
            bookIds: [piranesi],
        });

        await expect(result).rejects.toMatchObject({ reason: 'receiver-name-invalid' });
    });
    it('refuses a receiver that no longer exists', async () => {
        const current = lending();
        const { piranesi } = shelf(current);

        const result = subject(current).execute(owner, {
            receiver: { id: 'gone' },
            bookIds: [piranesi],
        });

        await expect(result).rejects.toMatchObject({ reason: 'receiver-missing' });
    });
    it('refuses an empty selection', async () => {
        const current = lending();

        const result = subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [],
        });

        await expect(result).rejects.toMatchObject({ reason: 'selection-empty' });
    });
    it('refuses a book selected twice', async () => {
        const current = lending();
        const { dune } = shelf(current);

        const result = subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [dune, dune],
        });

        await expect(result).rejects.toMatchObject({ reason: 'selection-duplicate' });
    });
    it('refuses a Not Owned book, lending none of the selection', async () => {
        const current = lending();
        const { piranesi, planned } = shelf(current);

        const result = subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi, planned],
        });

        await expect(result).rejects.toMatchObject({
            reason: 'book-not-owned',
            details: { bookIds: [planned] },
        });
        expect(current.loans.loans.size).toBe(0);
    });
    it('refuses a book already lent, lending none and creating no receiver', async () => {
        const current = lending();
        const { piranesi, dune } = shelf(current);
        const morgan = await receiver(current, 'Morgan');

        await lent(current, dune, morgan.id);

        const result = subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi, dune],
        });

        await expect(result).rejects.toMatchObject({
            reason: 'book-already-lent',
            details: { bookIds: [dune] },
        });
        expect(current.loans.of(piranesi)).toEqual([]);
        expect(current.receivers.receivers.size).toBe(1);
    });
    it('refuses a book that no longer exists', async () => {
        const current = lending();
        const { piranesi } = shelf(current);

        const result = subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi, 'gone'],
        });

        await expect(result).rejects.toMatchObject({
            code: 'not_found',
            reason: 'book-missing',
            details: { bookIds: ['gone'] },
        });
    });
    it('lends a returned book again as a new occurrence, keeping the first', async () => {
        const current = lending();
        const { dune } = shelf(current);
        const sam = await receiver(current, 'Sam Taylor');
        const first = await lent(current, dune, sam.id);

        Loan.returnTogether([first], '2026-10-10T09:00:00.000Z');
        await current.loans.save(first);

        await subject(current).execute(owner, { receiver: { id: sam.id }, bookIds: [dune] });

        expect(current.loans.of(dune).map((loan) => loan.snapshot.status)).toEqual([
            'returned',
            'lent',
        ]);
    });
    it('refuses a Guest', async () => {
        const current = lending();
        const { piranesi } = shelf(current);

        const result = subject(current).execute(guest, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi],
        });

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.loans.loans.size).toBe(0);
        expect(current.receivers.receivers.size).toBe(0);
    });
});

describe('LendBooks audit', () => {
    it('records one entry per lent book under one operation', async () => {
        const current = lending();
        const { piranesi, dune } = shelf(current);
        const sam = await receiver(current, 'Sam Taylor');

        await subject(current).execute(owner, {
            receiver: { id: sam.id },
            bookIds: [piranesi, dune],
        });

        expect(current.trail.entries).toEqual([
            expect.objectContaining({
                operationId: 'operation-1',
                category: 'loan.lent',
                outcome: 'successful',
                actorId: owner.id,
                subjectType: 'book',
                subjectId: piranesi,
                before: { loan: null },
                after: {
                    loan: {
                        loanId: 'id-1',
                        bookId: piranesi,
                        title: 'Piranesi',
                        isbn: null,
                        receiver: { id: sam.id, name: 'Sam Taylor' },
                        status: 'lent',
                        lentAt: '2026-10-30T09:00:00.000Z',
                        returnedAt: null,
                    },
                },
            }),
            expect.objectContaining({
                operationId: 'operation-1',
                category: 'loan.lent',
                subjectId: dune,
            }),
        ]);
    });
    it('records a created receiver as part of the lending operation', async () => {
        const current = lending();
        const { piranesi } = shelf(current);

        await subject(current).execute(owner, {
            receiver: { name: 'Sam Taylor' },
            bookIds: [piranesi],
        });

        expect(current.trail.entries.at(-1)).toMatchObject({
            operationId: 'operation-1',
            category: 'receiver.created',
            subjectType: 'receiver',
            subjectId: 'id-1',
            after: { name: 'Sam Taylor' },
        });
    });
    it('records a Failed entry for every selected book of a refused lending', async () => {
        const current = lending();
        const { piranesi, planned } = shelf(current);

        await subject(current)
            .execute(owner, { receiver: { name: 'Sam Taylor' }, bookIds: [piranesi, planned] })
            .catch(() => undefined);

        expect(current.trail.entries).toEqual([
            expect.objectContaining({
                outcome: 'failed',
                subjectId: piranesi,
                after: null,
                failure: 'conflict:book-not-owned',
            }),
            expect.objectContaining({
                outcome: 'failed',
                subjectId: planned,
                after: null,
                failure: 'conflict:book-not-owned',
            }),
        ]);
    });
});
