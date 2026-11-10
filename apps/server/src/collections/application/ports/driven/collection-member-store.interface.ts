export type MemberRecord = {
    bookId: string;
    collectionId: string;
    volumeFrom: number;
    volumeTo: number;
    title: string;
    isbn: string | null;
    publisher: string | null;
    category: 'books' | 'manga' | 'comics';
    ownership: 'owned' | 'not-owned';
    hasCover: boolean;
    // The book's last change, which versions its cover.
    updatedAt: string;
};

// Members come in coverage order (first volume, then title).
export interface CollectionMemberStore {
    ofBook(bookId: string): Promise<MemberRecord | null>;
    ofCollections(collectionIds: readonly string[]): Promise<MemberRecord[]>;
    // Replaces any previous membership of the book.
    place(
        bookId: string,
        collectionId: string,
        volumeFrom: number,
        volumeTo: number,
    ): Promise<void>;
    remove(bookId: string): Promise<void>;
    clear(collectionId: string): Promise<void>;
}
