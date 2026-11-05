// The library's simple book search, applied to collection listings: a collection matches when
// at least one of its books matches the whole search.
export interface CollectionBookSearch {
    collectionsMatching(search: string): Promise<string[]>;
}
