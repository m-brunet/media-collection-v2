import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type LoanStatus = 'lent' | 'returned';

export interface LoanState {
    id: string;
    bookId: string | null;
    receiverId: string;
    status: LoanStatus;
    lentAt: string;
    returnedAt: string | null;
    bookTitle: string;
    bookIsbn: string | null;
}

export interface LendableBook {
    id: string;
    title: string;
    isbn: string | null;
    ownership: 'owned' | 'not-owned';
    lentTo: string | null;
}

export class Loan {
    private readonly state: LoanState;

    private constructor(state: LoanState) {
        Failure.ensure(
            (state.status === 'lent' && state.returnedAt === null && state.bookId !== null) ||
                (state.status === 'returned' && state.returnedAt !== null),
            'This loan record is inconsistent.',
            'loan-invalid',
        );
        this.state = { ...state };
    }

    static restore(state: LoanState): Loan {
        return new Loan(state);
    }

    static ensureLendable(books: readonly LendableBook[]): void {
        const notOwned = books.filter((book) => book.ownership !== 'owned');

        if (notOwned.length > 0) {
            throw new Failure('conflict', 'Only Owned books can be lent.', 'book-not-owned', {
                bookIds: notOwned.map((book) => book.id),
            });
        }

        const lent = books.filter((book) => book.lentTo !== null);

        if (lent.length > 0) {
            throw new Failure('conflict', 'A selected book is already lent.', 'book-already-lent', {
                bookIds: lent.map((book) => book.id),
                lentTo: Object.fromEntries(lent.map((book) => [book.id, book.lentTo])),
            });
        }
    }

    static lend(input: { id: string; book: LendableBook; receiverId: string; now: string }): Loan {
        Loan.ensureLendable([input.book]);

        return new Loan({
            id: input.id,
            bookId: input.book.id,
            receiverId: input.receiverId,
            status: 'lent',
            lentAt: input.now,
            returnedAt: null,
            bookTitle: input.book.title,
            bookIsbn: input.book.isbn,
        });
    }

    static returnTogether(loans: readonly Loan[], now: string): void {
        Failure.ensure(loans.length > 0, 'Select at least one book.', 'selection-empty');
        Failure.ensure(
            new Set(loans.map((loan) => loan.state.receiverId)).size === 1,
            'Record the returns of one receiver at a time.',
            'loans-different-receivers',
        );

        const returned = loans.filter((loan) => !loan.active);

        if (returned.length > 0) {
            throw new Failure(
                'conflict',
                'A selected book has already been returned.',
                'loan-already-returned',
                { loanIds: returned.map((loan) => loan.id) },
            );
        }

        for (const loan of loans) {
            loan.state.status = 'returned';
            loan.state.returnedAt = now;
        }
    }

    get id(): string {
        return this.state.id;
    }

    get active(): boolean {
        return this.state.status === 'lent';
    }

    get snapshot(): LoanState {
        return { ...this.state };
    }
}
