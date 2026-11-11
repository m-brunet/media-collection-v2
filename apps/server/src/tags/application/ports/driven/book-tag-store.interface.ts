export interface BookTagStore {
    tagsOf(bookId: string): Promise<string[]>;
    replace(bookId: string, tagIds: readonly string[]): Promise<void>;
    countByTag(): Promise<Map<string, number>>;
}
