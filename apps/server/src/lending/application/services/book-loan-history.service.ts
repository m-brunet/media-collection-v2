import type { LoanRepository } from '../ports/driven/loan-repository.interface.js';
import type { LoanHistory } from '../../../books/application/ports/driven/loan-history.interface.js';

// Keeps the completed loans of a book being deleted identifiable by its former title and ISBN.
// The books feature refuses to delete a lent book, so only completed loans remain.
export class BookLoanHistory implements LoanHistory {
    constructor(private readonly loans: LoanRepository) {}

    async retain(book: { id: string; title: string; isbn: string | null }): Promise<void> {
        await this.loans.keepIdentification(book);
    }
}
