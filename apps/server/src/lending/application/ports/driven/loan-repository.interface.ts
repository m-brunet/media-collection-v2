import type { Loan } from '../../../domain/entities/loan.entity.js';

export interface LoanRepository {
    // Loans that do not exist are left out.
    findByIds(ids: readonly string[]): Promise<Loan[]>;
    // The active loans of the given books; books that are not lent are left out.
    findActiveByBooks(bookIds: readonly string[]): Promise<Loan[]>;
    // Records a new loan occurrence. A second active loan of the same book is a conflict
    // (`book-already-lent`), even when another operation created it meanwhile.
    create(loan: Loan): Promise<void>;
    // Saves the status and return date of an existing loan.
    save(loan: Loan): Promise<void>;
    // Refreshes the title and ISBN copy of every loan of the book, so its completed loans stay
    // identifiable once the book is deleted.
    keepIdentification(book: { id: string; title: string; isbn: string | null }): Promise<void>;
}
