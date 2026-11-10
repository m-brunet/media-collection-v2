export type BookTag = { id: string; name: string };

// Tags are ordered by name.
export interface BookTagReader {
    of(bookId: string): Promise<BookTag[]>;
}
