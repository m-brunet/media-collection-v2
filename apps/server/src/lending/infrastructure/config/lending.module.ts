import { Module } from '@nestjs/common';
import type { BookLoanReader } from '../../../books/application/ports/driven/book-loan-reader.interface.js';
import type { LoanHistory } from '../../../books/application/ports/driven/loan-history.interface.js';
import type { LoanRepository } from '../../application/ports/driven/loan-repository.interface.js';
import type { ReceiverRepository } from '../../application/ports/driven/receiver-repository.interface.js';
import { BookLoanHistory } from '../../application/services/book-loan-history.service.js';
import { BookLoanLookup } from '../../application/services/book-loan-lookup.service.js';

@Module({})
export class LendingModule {
    // Which books are lent, read by the books feature for its views and its delete / Not Owned
    // guard.
    static bookLoans(loans: LoanRepository, receivers: ReceiverRepository): BookLoanReader {
        return new BookLoanLookup(loans, receivers);
    }

    // Keeps completed loans identifiable when the books feature deletes a book.
    static history(loans: LoanRepository): LoanHistory {
        return new BookLoanHistory(loans);
    }
}
