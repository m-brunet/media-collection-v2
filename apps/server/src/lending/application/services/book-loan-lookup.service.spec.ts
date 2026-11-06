import { expect, it } from 'vitest';
import { lending, lent, receiver } from '../testing/lending-doubles.test-support.js';
import { Loan } from '../../domain/entities/loan.entity.js';
import { BookLoanLookup } from './book-loan-lookup.service.js';

it('names the receiver of a lent book and the lending date', async () => {
    const current = lending();
    const sam = await receiver(current, 'Sam Taylor');
    const loan = await lent(current, current.books.add('dune', 'Dune'), sam.id);

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
    const sam = await receiver(current, 'Sam Taylor');
    const loan = await lent(current, current.books.add('dune', 'Dune'), sam.id);

    Loan.returnTogether([loan], '2026-10-05T09:00:00.000Z');
    await current.loans.save(loan);

    const result = await new BookLoanLookup(current.loans, current.receivers).of('dune');

    expect(result).toBeNull();
});

it('maps only the lent books among several', async () => {
    const current = lending();
    const sam = await receiver(current, 'Sam Taylor');
    const morgan = await receiver(current, 'Morgan');

    await lent(current, current.books.add('dune', 'Dune'), sam.id);
    await lent(current, current.books.add('piranesi', 'Piranesi'), morgan.id);
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
