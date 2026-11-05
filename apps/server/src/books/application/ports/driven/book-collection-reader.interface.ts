export type BookCollection = { id: string; name: string; volumeFrom: number; volumeTo: number };

// The collection membership of a book, as shown with it and recorded in its audit snapshots.
// Owned by the collections feature.
export interface BookCollectionReader {
    of(bookId: string): Promise<BookCollection | null>;
}
