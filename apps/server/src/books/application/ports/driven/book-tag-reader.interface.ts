export type BookTag = { id: string; name: string };

// Reads the tags of books, owned by the tags feature, for views and audit snapshots. Tags are
// ordered by name.
export interface BookTagReader {
    of(bookId: string): Promise<BookTag[]>;
}
