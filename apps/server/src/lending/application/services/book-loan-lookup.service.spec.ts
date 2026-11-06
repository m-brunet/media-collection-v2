import { expect, it } from 'vitest';
import { ReceiverBuilder } from '../testing/receiver-builder.test-support.js';
import { LoanBuilder } from '../testing/loan-builder.test-support.js';
import { lending } from '../testing/lending-doubles.test-support.js';
import { Loan } from '../../domain/entities/loan.entity.js';
import { BookLoanLookup } from './book-loan-lookup.service.js';

it('names the receiver of a lent book and the lending date', async () => {
    const current = lending();
    const sam = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);
    const loan = await new LoanBuilder()
        .of(current.books.lendable(current.books.add('dune', 'Dune')))
        .to(sam.id)
        .buildAndSave(current);

    const result = await new BookLoanLookup(current.loans, current.receivers).of('dune');

    expect(result).toEqual({
        id: loan.id,
        receiverId: sam.id,
        receiverName: 'Sam Taylor',
        lentAt: '2026-10-01T09:00:00.000Z',
    });
});

it('finds no loan for a book that is not lent', async () => {
    const current = lending();

    current.books.add('dune', 'Dune');

    const result = await new BookLoanLookup(current.loans, current.receivers).of('dune');

    expect(result).toBeNull();
});

it('finds no loan for a returned book', async () => {
    const current = lending();
    const sam = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);
    const loan = await new LoanBuilder()
        .of(current.books.lendable(current.books.add('dune', 'Dune')))
        .to(sam.id)
        .buildAndSave(current);

    Loan.returnTogether([loan], '2026-10-05T09:00:00.000Z');
    await current.loans.save(loan);

    const result = await new BookLoanLookup(current.loans, current.receivers).of('dune');

    expect(result).toBeNull();
});

it('maps only the lent books among several', async () => {
    const current = lending();
    const sam = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);
    const morgan = await new ReceiverBuilder().withName('Morgan').buildAndSave(current);

    await new LoanBuilder()
        .of(current.books.lendable(current.books.add('dune', 'Dune')))
        .to(sam.id)
        .buildAndSave(current);
    await new LoanBuilder()
        .of(current.books.lendable(current.books.add('piranesi', 'Piranesi')))
        .to(morgan.id)
        .buildAndSave(current);
    current.books.add('overstory', 'Overstory');

    const result = await new BookLoanLookup(current.loans, current.receivers).ofBooks([
        'dune',
        'overstory',
        'piranesi',
    ]);

    expect([...result].map(([bookId, loan]) => [bookId, loan.receiverName])).toEqual([
        ['dune', 'Sam Taylor'],
        ['piranesi', 'Morgan'],
    ]);
});
