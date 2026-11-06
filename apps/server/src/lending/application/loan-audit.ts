import type { Loan } from '../domain/entities/loan.entity.js';
import type { Receiver } from '../domain/entities/receiver.entity.js';
import type { RelatedChange } from '../../shared/application/ports/driven/audit-entry.interface.js';

// Audit categories of the lending feature, all shared changes eligible for Activity. A lending
// records one entry per book (subject: the book); a return one entry per loan (subject: the
// loan). The entries of one operation share its ID, which Activity groups into one entry.
export const LoanAudit = {
    book: 'book',
    loan: 'loan',
    receiver: 'receiver',
    lent: 'loan.lent',
    returned: 'loan.returned',
    receiverCreated: 'receiver.created',
} as const;

export class LoanSnapshot {
    // The loan state of a book, with the receiver named so the record reads on its own.
    static of(loan: Loan, receiver: Receiver): Record<string, unknown> {
        const state = loan.snapshot;

        return {
            loanId: state.id,
            bookId: state.bookId,
            title: state.bookTitle,
            isbn: state.bookIsbn,
            receiver: { id: receiver.id, name: receiver.snapshot.name },
            status: state.status,
            lentAt: state.lentAt,
            returnedAt: state.returnedAt,
        };
    }

    static receiverCreated(receiver: Receiver): RelatedChange {
        return {
            category: LoanAudit.receiverCreated,
            subjectType: LoanAudit.receiver,
            subjectId: receiver.id,
            before: null,
            after: { name: receiver.snapshot.name },
        };
    }
}
