import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type LoanStatus = 'lent' | 'returned';

export interface LoanState {
    id: string;
    // Null once the book of a completed loan has been deleted; the title and ISBN then identify it.
    bookId: string | null;
    receiverId: string;
    status: LoanStatus;
    lentAt: string;
    returnedAt: string | null;
    bookTitle: string;
    bookIsbn: string | null;
}

// What lending needs to know about a book: its identity, ownership and whether it is lent now.
export interface LendableBook {
    id: string;
    title: string;
    isbn: string | null;
    ownership: 'owned' | 'not-owned';
    lent: boolean;
}

// One occurrence of a book handed to a receiver. Lending the same book again is a new loan, so
// completed loans are kept as history. Lending changes nothing else about the book.
export class Loan {
    private readonly state: LoanState;

    private constructor(state: LoanState) {
        this.state = { ...state };
    }

    static restore(state: LoanState): Loan {
        return new Loan(state);
    }

    // Only Owned books without an active loan can be lent. Every offending book is named, so the
    // person can correct the whole selection at once.
    static ensureLendable(books: readonly LendableBook[]): void {
        const notOwned = books.filter((book) => book.ownership !== 'owned');

        if (notOwned.length > 0) {
            throw new Failure('conflict', 'Only Owned books can be lent.', 'book-not-owned', {
                bookIds: notOwned.map((book) => book.id),
            });
        }

        const lent = books.filter((book) => book.lent);

        if (lent.length > 0) {
            throw new Failure('conflict', 'A selected book is already lent.', 'book-already-lent', {
                bookIds: lent.map((book) => book.id),
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

    // Records the books one receiver handed back together. All of them must still be lent, and to
    // the same person; otherwise none is returned.
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
