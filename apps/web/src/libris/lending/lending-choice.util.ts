import type { BookLoanDto, BookOwnership } from '../../../../../packages/contracts/src/http';

// A book as the lending page shows it, in the selection or among the books found.
export interface LendingBook {
    id: string;
    title: string;
    authors: string[];
    // Edition details distinguishing this book from others with the same title, when known.
    edition: string | null;
    ownership: BookOwnership;
    loan: BookLoanDto | null;
    // Set once the server said the book no longer exists.
    gone?: boolean;
}

export type LendingAvailability = 'selected' | 'available' | 'lent' | 'not-owned' | 'gone';

// Rules the lending page applies before asking the server, which checks them again: only Owned
// books without an active loan can be lent, each once.
export class LendingChoice {
    static availability(book: LendingBook, selected: readonly LendingBook[]): LendingAvailability {
        if (book.gone) {
            return 'gone';
        }

        if (book.ownership !== 'owned') {
            return 'not-owned';
        }

        if (book.loan) {
            return 'lent';
        }

        return selected.some((other) => other.id === book.id) ? 'selected' : 'available';
    }

    // The selection with the server's answer about the given books applied, keeping its order.
    static refreshed(
        selected: readonly LendingBook[],
        fresh: readonly LendingBook[],
    ): LendingBook[] {
        return selected.map((book) => fresh.find((other) => other.id === book.id) ?? book);
    }
}
