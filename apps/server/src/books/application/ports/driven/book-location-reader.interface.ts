export type BookLocation = {
    bookcaseId: string;
    bookcaseName: string;
    shelfId: string;
    shelfName: string;
};

export interface BookLocationReader {
    of(bookId: string): Promise<BookLocation | null>;
}
