export type BookLoan = { id: string; receiverId: string; receiverName: string; lentAt: string };

export interface BookLoanReader {
    of(bookId: string): Promise<BookLoan | null>;
    ofBooks(bookIds: readonly string[]): Promise<Map<string, BookLoan>>;
}
