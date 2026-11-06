import { describe, expect, it } from 'vitest';
import { lending } from './lending-doubles.test-support.js';
import { LoanBuilder } from './loan-builder.test-support.js';
import { ReceiverBuilder } from './receiver-builder.test-support.js';

describe('LoanBuilder.build', () => {
    it('builds an active loan by default', () => {
        const builder = new LoanBuilder();

        const result = builder.build();

        expect(result.active).toBe(true);
        expect(result.snapshot).toMatchObject({
            status: 'lent',
            lentAt: '2026-10-01T09:00:00.000Z',
            returnedAt: null,
        });
    });
    it('records the book it was given', () => {
        const builder = new LoanBuilder().of({ id: 'dune', title: 'Dune', isbn: '9780441013593' });

        const result = builder.build();

        expect(result.snapshot).toMatchObject({
            bookId: 'dune',
            bookTitle: 'Dune',
            bookIsbn: '9780441013593',
        });
    });
    it('builds a coherent completed loan', () => {
        const builder = new LoanBuilder().asReturned('2026-10-20T09:00:00.000Z');

        const result = builder.build();

        expect(result.active).toBe(false);
        expect(result.snapshot).toMatchObject({
            status: 'returned',
            returnedAt: '2026-10-20T09:00:00.000Z',
        });
    });
});

describe('LoanBuilder.buildAndSave', () => {
    it('saves the loan of the given book to the given receiver', async () => {
        const current = lending();
        const sam = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);

        const result = await new LoanBuilder().of({ id: 'dune' }).to(sam.id).buildAndSave(current);

        expect(current.loans.of('dune').map((loan) => loan.snapshot.receiverId)).toEqual([sam.id]);
        expect(result.snapshot.receiverId).toBe(sam.id);
    });
    it('creates a receiver when none was given', async () => {
        const current = lending();

        const result = await new LoanBuilder().of({ id: 'dune' }).buildAndSave(current);

        expect(await current.receivers.findById(result.snapshot.receiverId)).not.toBeNull();
    });
    it('refuses to save a loan without its book', async () => {
        const current = lending();

        const result = new LoanBuilder().buildAndSave(current);

        await expect(result).rejects.toThrow('LoanBuilder cannot save without a book');
    });
});
