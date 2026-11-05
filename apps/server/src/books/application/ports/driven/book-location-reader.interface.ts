// Where a book is physically kept: always a shelf within its bookcase.
export type BookLocation = {
    bookcaseId: string;
    bookcaseName: string;
    shelfId: string;
    shelfName: string;
};

// Reads the physical location of books, owned by the locations feature, for views and audit
// snapshots.
export interface BookLocationReader {
    of(bookId: string): Promise<BookLocation | null>;
}
