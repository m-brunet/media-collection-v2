export type BookTag = { id: string; name: string };

export interface BookTagReader {
    of(bookId: string): Promise<BookTag[]>;
}
