import type { BookLoanReader } from '../ports/driven/book-loan-reader.interface.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

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
