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
    updatedAt: string;
};

export interface CollectionMemberStore {
    ofBook(bookId: string): Promise<MemberRecord | null>;
    ofCollections(collectionIds: readonly string[]): Promise<MemberRecord[]>;
    place(
        bookId: string,
        collectionId: string,
        volumeFrom: number,
        volumeTo: number,
    ): Promise<void>;
    remove(bookId: string): Promise<void>;
    clear(collectionId: string): Promise<void>;
}
