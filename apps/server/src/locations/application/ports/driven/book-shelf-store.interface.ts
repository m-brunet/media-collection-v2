export interface BookShelfStore {
    shelfOf(bookId: string): Promise<string | null>;
    place(bookId: string, shelfId: string): Promise<void>;
    remove(bookId: string): Promise<void>;
    countByShelf(): Promise<Map<string, number>>;
}
