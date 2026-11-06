import { expect, it } from 'vitest';
import { LoanSnapshot } from './loan-audit.js';
import { Loan } from '../domain/entities/loan.entity.js';
import { Receiver } from '../domain/entities/receiver.entity.js';

const sam = new Receiver({ id: 'sam', name: 'Sam Taylor', createdAt: '2026-01-01T00:00:00.000Z' });

it('describes a loan with its book and its receiver', () => {
    const loan = Loan.lend({
        id: 'loan-1',
        book: {
            id: 'piranesi',
            title: 'Piranesi',
            isbn: '9781635575637',
            ownership: 'owned',
            lentTo: null,
        },
        receiverId: sam.id,
        now: '2026-10-30T09:00:00.000Z',
    });

    const result = LoanSnapshot.of(loan, sam);

    expect(result).toEqual({
        loanId: 'loan-1',
        bookId: 'piranesi',
        title: 'Piranesi',
        isbn: '9781635575637',
        receiver: { id: 'sam', name: 'Sam Taylor' },
        status: 'lent',
        lentAt: '2026-10-30T09:00:00.000Z',
        returnedAt: null,
    });
});

it('records a receiver created by a lending as a related change', () => {
    const receiver = sam;

    const result = LoanSnapshot.receiverCreated(receiver);

    expect(result).toEqual({
        category: 'receiver.created',
        subjectType: 'receiver',
        subjectId: 'sam',
        before: null,
        after: { name: 'Sam Taylor' },
    });
});
