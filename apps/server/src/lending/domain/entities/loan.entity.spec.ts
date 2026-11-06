import { describe, expect, it } from 'vitest';
import { Loan, type LendableBook, type LoanState } from './loan.entity.js';

const lentAt = '2026-10-30T09:00:00.000Z';
const returnedAt = '2026-11-02T18:00:00.000Z';

const book = (overrides: Partial<LendableBook> = {}): LendableBook => ({
    id: 'piranesi',
    title: 'Piranesi',
    isbn: '9781635575637',
    ownership: 'owned',
    lentTo: null,
    ...overrides,
});

const loan = (overrides: Partial<LoanState> = {}): Loan =>
    Loan.restore({
        id: 'loan-piranesi',
        bookId: 'piranesi',
        receiverId: 'sam',
        status: 'lent',
        lentAt,
        returnedAt: null,
        bookTitle: 'Piranesi',
        bookIsbn: '9781635575637',
        ...overrides,
    });

describe('Loan.lend', () => {
    it('lends an Owned book that is not lent', () => {
        const available = book();

        const result = Loan.lend({ id: 'loan-1', book: available, receiverId: 'sam', now: lentAt });

        expect(result.snapshot).toEqual({
            id: 'loan-1',
            bookId: 'piranesi',
            receiverId: 'sam',
            status: 'lent',
            lentAt,
            returnedAt: null,
            bookTitle: 'Piranesi',
            bookIsbn: '9781635575637',
        });
        expect(result.active).toBe(true);
    });
    it('keeps no ISBN for a book without one', () => {
        const withoutIsbn = book({ isbn: null });

        const result = Loan.lend({
            id: 'loan-1',
            book: withoutIsbn,
            receiverId: 'sam',
            now: lentAt,
        });

        expect(result.snapshot.bookIsbn).toBeNull();
    });
    it('refuses a Not Owned book', () => {
        const planned = book({ ownership: 'not-owned' });

        const operation = () =>
            Loan.lend({ id: 'loan-1', book: planned, receiverId: 'sam', now: lentAt });

        expect(operation).toThrow(
            expect.objectContaining({
                code: 'conflict',
                reason: 'book-not-owned',
                details: { bookIds: ['piranesi'] },
            }),
        );
    });
    it('refuses a book that is already lent', () => {
        const lent = book({ lentTo: 'Morgan' });

        const operation = () =>
            Loan.lend({ id: 'loan-1', book: lent, receiverId: 'sam', now: lentAt });

        expect(operation).toThrow(
            expect.objectContaining({
                code: 'conflict',
                reason: 'book-already-lent',
                details: { bookIds: ['piranesi'], lentTo: { piranesi: 'Morgan' } },
            }),
        );
    });
});

describe('Loan.ensureLendable', () => {
    it('accepts a selection of available Owned books', () => {
        const books = [book(), book({ id: 'dune', title: 'Dune' })];

        const operation = () => Loan.ensureLendable(books);

        expect(operation).not.toThrow();
    });
    it('names every Not Owned book of the selection', () => {
        const books = [
            book({ id: 'dune', ownership: 'not-owned' }),
            book(),
            book({ id: 'overstory', ownership: 'not-owned' }),
        ];

        const operation = () => Loan.ensureLendable(books);

        expect(operation).toThrow(
            expect.objectContaining({
                reason: 'book-not-owned',
                details: { bookIds: ['dune', 'overstory'] },
            }),
        );
    });
    it('names every already lent book of the selection', () => {
        const books = [
            book({ id: 'dune', lentTo: 'Morgan' }),
            book(),
            book({ id: 'overstory', lentTo: 'Sam Taylor' }),
        ];

        const operation = () => Loan.ensureLendable(books);

        expect(operation).toThrow(
            expect.objectContaining({
                reason: 'book-already-lent',
                details: {
                    bookIds: ['dune', 'overstory'],
                    lentTo: { dune: 'Morgan', overstory: 'Sam Taylor' },
                },
            }),
        );
    });
});

describe('Loan.returnTogether', () => {
    it('returns a single lent book', () => {
        const piranesi = loan();

        Loan.returnTogether([piranesi], returnedAt);

        expect(piranesi.snapshot).toMatchObject({ status: 'returned', returnedAt });
        expect(piranesi.active).toBe(false);
    });
    it('returns books of the same receiver lent on separate occasions', () => {
        const piranesi = loan();
        const dune = loan({ id: 'loan-dune', bookId: 'dune', lentAt: '2026-10-25T09:00:00.000Z' });

        Loan.returnTogether([piranesi, dune], returnedAt);

        expect(piranesi.active).toBe(false);
        expect(dune.active).toBe(false);
    });
    it('keeps the lending date and book identification when returning', () => {
        const piranesi = loan();

        Loan.returnTogether([piranesi], returnedAt);

        expect(piranesi.snapshot).toMatchObject({
            bookId: 'piranesi',
            receiverId: 'sam',
            lentAt,
            bookTitle: 'Piranesi',
            bookIsbn: '9781635575637',
        });
    });
    it('refuses an empty selection', () => {
        const loans: Loan[] = [];

        const operation = () => Loan.returnTogether(loans, returnedAt);

        expect(operation).toThrow(expect.objectContaining({ reason: 'selection-empty' }));
    });
    it('refuses loans of different receivers and returns none of them', () => {
        const piranesi = loan();
        const dune = loan({ id: 'loan-dune', bookId: 'dune', receiverId: 'morgan' });

        const operation = () => Loan.returnTogether([piranesi, dune], returnedAt);

        expect(operation).toThrow(expect.objectContaining({ reason: 'loans-different-receivers' }));
        expect(piranesi.active).toBe(true);
        expect(dune.active).toBe(true);
    });
    it('refuses an already returned loan and returns none of the selection', () => {
        const piranesi = loan();
        const dune = loan({ id: 'loan-dune', bookId: 'dune', status: 'returned', returnedAt });

        const operation = () => Loan.returnTogether([piranesi, dune], returnedAt);

        expect(operation).toThrow(
            expect.objectContaining({
                code: 'conflict',
                reason: 'loan-already-returned',
                details: { loanIds: ['loan-dune'] },
            }),
        );
        expect(piranesi.active).toBe(true);
    });
});

describe('Loan history', () => {
    it('keeps a completed loan of a deleted book identifiable by its former title and ISBN', () => {
        const state = { bookId: null, status: 'returned' as const, returnedAt };

        const result = loan(state);

        expect(result.snapshot).toMatchObject({
            bookId: null,
            bookTitle: 'Piranesi',
            bookIsbn: '9781635575637',
        });
    });
});

describe('Loan.restore', () => {
    it('refuses an active loan with a return date', () => {
        const state = { returnedAt };

        const operation = () => loan(state);

        expect(operation).toThrow(expect.objectContaining({ reason: 'loan-invalid' }));
    });
    it('refuses a returned loan without a return date', () => {
        const state = { status: 'returned' as const };

        const operation = () => loan(state);

        expect(operation).toThrow(expect.objectContaining({ reason: 'loan-invalid' }));
    });
    it('refuses an active loan without its book', () => {
        const state = { bookId: null };

        const operation = () => loan(state);

        expect(operation).toThrow(expect.objectContaining({ reason: 'loan-invalid' }));
    });
    it('refuses an unknown status', () => {
        const state = { status: 'lost' as never, returnedAt };

        const operation = () => loan(state);

        expect(operation).toThrow(expect.objectContaining({ reason: 'loan-invalid' }));
    });
});
