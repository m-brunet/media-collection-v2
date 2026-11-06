import type { BookLoanReader } from '../ports/driven/book-loan-reader.interface.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

// A lent book must stay in the library as an Owned book until it is returned: it can be neither
// deleted nor changed to Not Owned while its loan is active.
export class LentBookGuard {
    constructor(private readonly loans: BookLoanReader) {}

    async ensureNotLent(bookId: string): Promise<void> {
        const loan = await this.loans.of(bookId);

        if (loan) {
            throw new Failure(
                'conflict',
                'Return this book before deleting it or changing it to Not Owned.',
                'book-lent',
                { receiverName: loan.receiverName },
            );
        }
    }
}
