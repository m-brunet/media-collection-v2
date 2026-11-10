export type BookCollection = { id: string; name: string; volumeFrom: number; volumeTo: number };

export interface BookCollectionReader {
    of(bookId: string): Promise<BookCollection | null>;
}
