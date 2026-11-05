// Which shelf each book is kept on: at most one per book.
export interface BookShelfStore {
    shelfOf(bookId: string): Promise<string | null>;
    place(bookId: string, shelfId: string): Promise<void>;
    remove(bookId: string): Promise<void>;
    // Number of books on each shelf that holds any.
    countByShelf(): Promise<Map<string, number>>;
}
