export type SourceRefusal = { kind: 'limited'; retryAt: Date | null } | { kind: 'busy' };

export type SourceReply<T> = { kind: 'found'; value: T } | { kind: 'none' } | SourceRefusal;

export type SourceTurn = { bulk: boolean; signal?: AbortSignal };

export interface LookupSource<T> {
    readonly name: string;
    readonly batchSize: number;
    find(
        isbn13s: readonly string[],
        turn: SourceTurn,
    ): Promise<SourceReply<ReadonlyMap<string, T>>>;
}
