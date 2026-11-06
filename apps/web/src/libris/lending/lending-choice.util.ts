import type { BookLoanDto, BookOwnership } from '../../../../../packages/contracts/src/http';

// Why the server refused to lend a selected book, as its refusal explained it.
export type LendingRefusal =
    | { kind: 'lent'; receiverName: string | null }
    | { kind: 'not-owned' }
    | { kind: 'gone' };

// A book as the lending page shows it, in the selection or among the books found.
export interface LendingBook {
    id: string;
    title: string;
    authors: string[];
    // Edition details distinguishing this book from others with the same title, when known.
    edition: string | null;
    ownership: BookOwnership;
    loan: BookLoanDto | null;
    // Set when the server refused to lend this book; it is newer than the other fields.
    refusal?: LendingRefusal;
}

export type LendingAvailability = 'selected' | 'available' | 'lent' | 'not-owned' | 'gone';

// Rules the lending page applies before asking the server, which checks them again: only Owned
// books without an active loan can be lent, each once.
export class LendingChoice {
    static availability(book: LendingBook, selected: readonly LendingBook[]): LendingAvailability {
        if (book.refusal) {
            return book.refusal.kind;
        }

        if (book.ownership !== 'owned') {
            return 'not-owned';
        }

        if (book.loan) {
            return 'lent';
        }

        return selected.some((other) => other.id === book.id) ? 'selected' : 'available';
    }

    // Who has a lent book, when known.
    static lentTo(book: LendingBook): string | null {
        return book.refusal?.kind === 'lent'
            ? book.refusal.receiverName
            : (book.loan?.receiverName ?? null);
    }

    // The selection with the server's refusal applied to the books it names, keeping its order.
    // Details: `bookIds`, and for books already lent `lentTo` (receiver name by book).
    static refused(
        selected: readonly LendingBook[],
        reason: string,
        details: Record<string, unknown> | null,
    ): LendingBook[] {
        const ids = new Set((details?.bookIds as string[] | undefined) ?? []);
        const lentTo = (details?.lentTo as Record<string, string> | undefined) ?? {};

        return selected.map((book) => {
            if (!ids.has(book.id)) {
                return book;
            }

            switch (reason) {
                case 'book-already-lent':
                    return {
                        ...book,
                        refusal: { kind: 'lent', receiverName: lentTo[book.id] ?? null },
                    };
                case 'book-not-owned':
                    return { ...book, refusal: { kind: 'not-owned' } };
                case 'book-missing':
                    return { ...book, refusal: { kind: 'gone' } };
                default:
                    return book;
            }
        });
    }
}
