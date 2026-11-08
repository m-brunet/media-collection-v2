import { expect, it } from 'vitest';
import { ReceiverBuilder } from '../testing/receiver-builder.test-support.js';
import { LoanBuilder } from '../testing/loan-builder.test-support.js';
import { LendingDoubles } from '../testing/lending-doubles.test-support.js';
import { Loan } from '../../domain/entities/loan.entity.js';
import { BookLoanHistory } from './book-loan-history.service.js';

it('keeps the current title and ISBN on the completed loans of a book being deleted', async () => {
    const current = LendingDoubles.lending();
    const sam = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);
    const loan = await new LoanBuilder()
        .of(current.books.lendable(current.books.add('dune', 'Dune')))
        .to(sam.id)
        .buildAndSave(current);

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
    const current = LendingDoubles.lending();
    const sam = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);

    await new LoanBuilder()
        .of(current.books.lendable(current.books.add('piranesi', 'Piranesi')))
        .to(sam.id)
        .buildAndSave(current);

    await new BookLoanHistory(current.loans).retain({ id: 'dune', title: 'Dune', isbn: null });

    expect(current.loans.of('piranesi')[0]?.snapshot.bookTitle).toBe('Piranesi');
});
