// Each account's own Read / Not read status per book. No record means Not read.
export interface ReadingStatusStore {
    isRead(userId: string, bookId: string): Promise<boolean>;
    set(userId: string, bookId: string, read: boolean): Promise<void>;
}
