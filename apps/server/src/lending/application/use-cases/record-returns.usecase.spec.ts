import { describe, expect, it } from 'vitest';
import { guest, lending, lent, owner, receiver } from '../testing/lending-doubles.test-support.js';
import { Loan } from '../../domain/entities/loan.entity.js';
import { RecordReturns } from './record-returns.usecase.js';

function subject(current: ReturnType<typeof lending>) {
    return new RecordReturns(current.loans, current.receivers, current.clock, current.operations);
}

// Sam has three books from two lending occasions; Morgan has one.
async function onLoan(current: ReturnType<typeof lending>) {
    const sam = await receiver(current, 'Sam Taylor');
    const morgan = await receiver(current, 'Morgan');
    const piranesi = await lent(
        current,
        current.books.add('piranesi', 'Piranesi'),
        sam.id,
        '2026-10-25T09:00:00.000Z',
    );
    const dune = await lent(current, current.books.add('dune', 'Dune'), sam.id);
    const overstory = await lent(current, current.books.add('overstory', 'Overstory'), sam.id);
    const sweetgrass = await lent(
        current,
        current.books.add('sweetgrass', 'Sweetgrass'),
        morgan.id,
    );

    return { sam, morgan, piranesi, dune, overstory, sweetgrass };
}

function statuses(current: ReturnType<typeof lending>) {
    return Object.fromEntries(
        [...current.loans.loans.values()].map((loan) => [
            loan.snapshot.bookId,
            loan.snapshot.status,
        ]),
    );
}

describe('RecordReturns', () => {
    it('returns one book and leaves the others lent', async () => {
        const current = lending();
        const { dune } = await onLoan(current);

        await subject(current).execute(owner, [dune.id]);

        expect(statuses(current)).toEqual({
            piranesi: 'lent',
            dune: 'returned',
            overstory: 'lent',
            sweetgrass: 'lent',
        });
    });
    it('returns books of the receiver lent on separate occasions together', async () => {
        const current = lending();
        const { piranesi, dune, overstory } = await onLoan(current);

        await subject(current).execute(owner, [piranesi.id, dune.id, overstory.id]);

        expect(statuses(current)).toMatchObject({
            piranesi: 'returned',
            dune: 'returned',
            overstory: 'returned',
        });
    });
    it('reports the receiver and the returned books', async () => {
        const current = lending();
        const { sam, dune, overstory } = await onLoan(current);

        const result = await subject(current).execute(owner, [dune.id, overstory.id]);

        expect(result).toEqual({
            receiver: { id: sam.id, name: 'Sam Taylor' },
            returned: [
                { loanId: dune.id, bookId: 'dune', returnedAt: '2026-10-30T09:00:00.000Z' },
                {
                    loanId: overstory.id,
                    bookId: 'overstory',
                    returnedAt: '2026-10-30T09:00:00.000Z',
                },
            ],
        });
    });
    it('refuses loans of different receivers, returning none', async () => {
        const current = lending();
        const { dune, sweetgrass } = await onLoan(current);

        const result = subject(current).execute(owner, [dune.id, sweetgrass.id]);

        await expect(result).rejects.toMatchObject({ reason: 'loans-different-receivers' });
        expect(statuses(current)).toMatchObject({ dune: 'lent', sweetgrass: 'lent' });
    });
    it('refuses a loan already returned by someone else, returning none of the selection', async () => {
        const current = lending();
        const { dune, overstory } = await onLoan(current);

        Loan.returnTogether([dune], '2026-10-29T09:00:00.000Z');
        await current.loans.save(dune);

        const result = subject(current).execute(owner, [dune.id, overstory.id]);

        await expect(result).rejects.toMatchObject({
            code: 'conflict',
            reason: 'loan-already-returned',
            details: { loanIds: [dune.id] },
        });
        expect(statuses(current)).toMatchObject({ overstory: 'lent' });
    });
    it('refuses a loan that does not exist', async () => {
        const current = lending();
        const { dune } = await onLoan(current);

        const result = subject(current).execute(owner, [dune.id, 'gone']);

        await expect(result).rejects.toMatchObject({
            code: 'not_found',
            reason: 'loan-missing',
            details: { loanIds: ['gone'] },
        });
    });
    it('refuses an empty selection', async () => {
        const current = lending();

        const result = subject(current).execute(owner, []);

        await expect(result).rejects.toMatchObject({ reason: 'selection-empty' });
    });
    it('refuses a loan selected twice', async () => {
        const current = lending();
        const { dune } = await onLoan(current);

        const result = subject(current).execute(owner, [dune.id, dune.id]);

        await expect(result).rejects.toMatchObject({ reason: 'selection-duplicate' });
    });
    it('refuses a Guest', async () => {
        const current = lending();
        const { dune } = await onLoan(current);

        const result = subject(current).execute(guest, [dune.id]);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(statuses(current)).toMatchObject({ dune: 'lent' });
    });
});

describe('RecordReturns audit', () => {
    it('records one entry per returned loan under one operation, with before and after', async () => {
        const current = lending();
        const { sam, dune, overstory } = await onLoan(current);

        await subject(current).execute(owner, [dune.id, overstory.id]);

        expect(current.trail.entries).toEqual([
            expect.objectContaining({
                operationId: 'operation-1',
                category: 'loan.returned',
                outcome: 'successful',
                subjectType: 'loan',
                subjectId: dune.id,
                before: {
                    loan: expect.objectContaining({ status: 'lent', returnedAt: null }),
                },
                after: {
                    loan: expect.objectContaining({
                        bookId: 'dune',
                        title: 'Dune',
                        receiver: { id: sam.id, name: 'Sam Taylor' },
                        status: 'returned',
                        returnedAt: '2026-10-30T09:00:00.000Z',
                    }),
                },
            }),
            expect.objectContaining({ operationId: 'operation-1', subjectId: overstory.id }),
        ]);
    });
    it('records a Failed entry for every selected loan of a refused return', async () => {
        const current = lending();
        const { dune, sweetgrass } = await onLoan(current);

        await subject(current)
            .execute(owner, [dune.id, sweetgrass.id])
            .catch(() => undefined);

        expect(current.trail.entries.map((entry) => [entry.subjectId, entry.outcome])).toEqual([
            [dune.id, 'failed'],
            [sweetgrass.id, 'failed'],
        ]);
    });
});
