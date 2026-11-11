export interface LoanHistory {
    retain(book: { id: string; title: string; isbn: string | null }): Promise<void>;
}
