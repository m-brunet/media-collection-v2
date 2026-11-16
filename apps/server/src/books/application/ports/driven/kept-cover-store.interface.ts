export type KeptCover = { id: string; isbn13: string; file: string; keptAt: string };

export interface KeptCoverStore {
    find(isbn13: string): Promise<KeptCover | null>;
    put(cover: KeptCover): Promise<void>;
    remove(isbn13: string): Promise<void>;
    all(): Promise<KeptCover[]>;
    clear(): Promise<number>;
}
