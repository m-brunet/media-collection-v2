export interface CollectionOwnedBooks {
    of(collectionId: string): Promise<string[]>;
}
