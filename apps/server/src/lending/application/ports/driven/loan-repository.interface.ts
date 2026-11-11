import type { Loan } from '../../../domain/entities/loan.entity.js';

export interface LoanRepository {
    findByIds(ids: readonly string[]): Promise<Loan[]>;
    findActiveByBooks(bookIds: readonly string[]): Promise<Loan[]>;
    create(loan: Loan): Promise<void>;
    save(loan: Loan): Promise<void>;
    keepIdentification(book: { id: string; title: string; isbn: string | null }): Promise<void>;
}
