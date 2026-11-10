import type { LoanRepository } from '../ports/driven/loan-repository.interface.js';
import type { ReceiverRepository } from '../ports/driven/receiver-repository.interface.js';
import type {
    BookLoan,
    BookLoanReader,
} from '../../../books/application/ports/driven/book-loan-reader.interface.js';

export class BookLoanLookup implements BookLoanReader {
    constructor(
        private readonly loans: LoanRepository,
        private readonly receivers: ReceiverRepository,
    ) {}

    async of(bookId: string): Promise<BookLoan | null> {
        return (await this.ofBooks([bookId])).get(bookId) ?? null;
    }

    async ofBooks(bookIds: readonly string[]): Promise<Map<string, BookLoan>> {
        const loans = await this.loans.findActiveByBooks(bookIds);
        const receivers = new Map(
            (
                await this.receivers.findByIds([
                    ...new Set(loans.map((loan) => loan.snapshot.receiverId)),
                ])
            ).map((receiver) => [receiver.id, receiver.snapshot.name]),
        );
        const lent = new Map<string, BookLoan>();

        for (const loan of loans) {
            const { id, bookId, receiverId, lentAt } = loan.snapshot;

            if (bookId !== null) {
                lent.set(bookId, {
                    id,
                    receiverId,
                    receiverName: receivers.get(receiverId) ?? '',
                    lentAt,
                });
            }
        }

        return lent;
    }
}
