import type { Loan } from '../../../domain/entities/loan.entity.js';

export interface LoanRepository {
    // Loans that do not exist are left out.
    findByIds(ids: readonly string[]): Promise<Loan[]>;
    // Records a new loan occurrence. A second active loan of the same book is a conflict
    // (`book-already-lent`), even when another operation created it meanwhile.
    create(loan: Loan): Promise<void>;
    // Saves the status and return date of an existing loan.
    save(loan: Loan): Promise<void>;
}
