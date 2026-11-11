import type { BookLoanDto, BookOwnership } from '../../../../../packages/contracts/src/http';

export type LendingRefusal =
    | { kind: 'lent'; receiverName: string | null }
    | { kind: 'not-owned' }
    | { kind: 'gone' };

export interface LendingBook {
    id: string;
    title: string;
    authors: string[];
    edition: string | null;
    ownership: BookOwnership;
    loan: BookLoanDto | null;
    refusal?: LendingRefusal;
}

export type LendingAvailability = 'selected' | 'available' | 'lent' | 'not-owned' | 'gone';

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

    static lentTo(book: LendingBook): string | null {
        return book.refusal?.kind === 'lent'
            ? book.refusal.receiverName
            : (book.loan?.receiverName ?? null);
    }

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
