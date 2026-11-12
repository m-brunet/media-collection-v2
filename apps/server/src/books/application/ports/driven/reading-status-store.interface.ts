export interface ReadingStatusStore {
    isRead(userId: string, bookId: string): Promise<boolean>;
    readAmong(userId: string, bookIds: readonly string[]): Promise<Set<string>>;
    set(userId: string, bookId: string, read: boolean): Promise<void>;
}
