import type { LoanRepository } from '../ports/driven/loan-repository.interface.js';
import type { LoanHistory } from '../../../books/application/ports/driven/loan-history.interface.js';

export class BookLoanHistory implements LoanHistory {
    constructor(private readonly loans: LoanRepository) {}

    async retain(book: { id: string; title: string; isbn: string | null }): Promise<void> {
        await this.loans.keepIdentification(book);
    }
}
