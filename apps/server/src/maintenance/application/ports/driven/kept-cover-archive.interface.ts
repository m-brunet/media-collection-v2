export type KeptCoverSummary = { count: number; bytes: number; oldestKeptAt: string | null };

export interface KeptCoverArchive {
    summary(): Promise<KeptCoverSummary>;
    deleteAll(): Promise<number>;
}
