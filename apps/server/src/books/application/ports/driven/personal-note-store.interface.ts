// At most one private note per account and book. Only its author ever reads it.
export interface PersonalNoteStore {
    find(userId: string, bookId: string): Promise<{ text: string; updatedAt: string } | null>;
    save(userId: string, bookId: string, text: string, updatedAt: string): Promise<void>;
    delete(userId: string, bookId: string): Promise<void>;
}
