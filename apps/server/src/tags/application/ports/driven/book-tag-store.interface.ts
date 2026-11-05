// Which tags each book carries.
export interface BookTagStore {
    tagsOf(bookId: string): Promise<string[]>;
    replace(bookId: string, tagIds: readonly string[]): Promise<void>;
    // Number of books carrying each tag that is used at all.
    countByTag(): Promise<Map<string, number>>;
}
