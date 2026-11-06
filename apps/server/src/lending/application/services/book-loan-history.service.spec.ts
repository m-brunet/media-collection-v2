import { expect, it } from 'vitest';
import { lending, lent, receiver } from '../testing/lending-doubles.test-support.js';
import { Loan } from '../../domain/entities/loan.entity.js';
import { BookLoanHistory } from './book-loan-history.service.js';

it('keeps the current title and ISBN on the completed loans of a book being deleted', async () => {
    const current = lending();
    const sam = await receiver(current, 'Sam Taylor');
    const loan = await lent(current, current.books.add('dune', 'Dune'), sam.id);

    Loan.returnTogether([loan], '2026-10-05T09:00:00.000Z');
    await current.loans.save(loan);

    await new BookLoanHistory(current.loans).retain({
        id: 'dune',
        title: 'Dune (Deluxe)',
        isbn: '9780593099322',
    });

    expect(current.loans.of('dune').map((kept) => kept.snapshot)).toEqual([
        expect.objectContaining({
            status: 'returned',
            bookTitle: 'Dune (Deluxe)',
            bookIsbn: '9780593099322',
        }),
    ]);
});

it('leaves the loans of other books unchanged', async () => {
    const current = lending();
    const sam = await receiver(current, 'Sam Taylor');

    await lent(current, current.books.add('piranesi', 'Piranesi'), sam.id);

    await new BookLoanHistory(current.loans).retain({ id: 'dune', title: 'Dune', isbn: null });

    expect(current.loans.of('piranesi')[0]?.snapshot.bookTitle).toBe('Piranesi');
});
