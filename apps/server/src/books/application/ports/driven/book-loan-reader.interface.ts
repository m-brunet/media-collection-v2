// The active loan of a book, as the books feature shows it: who has it and since when.
export type BookLoan = { id: string; receiverId: string; receiverName: string; lentAt: string };

// Active loans of books, owned by the lending feature.
export interface BookLoanReader {
    of(bookId: string): Promise<BookLoan | null>;
    // Only the lent books among those given appear in the map.
    ofBooks(bookIds: readonly string[]): Promise<Map<string, BookLoan>>;
}
