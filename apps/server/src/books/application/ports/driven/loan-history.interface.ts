// Joins the transaction of the book operation in progress.
export interface LoanHistory {
    // Before the book is deleted: keeps its completed loans identifiable by its current title
    // and ISBN once the book itself is gone.
    retain(book: { id: string; title: string; isbn: string | null }): Promise<void>;
}
