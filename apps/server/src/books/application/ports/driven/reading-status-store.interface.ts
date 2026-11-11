export interface ReadingStatusStore {
    isRead(userId: string, bookId: string): Promise<boolean>;
    set(userId: string, bookId: string, read: boolean): Promise<void>;
}
