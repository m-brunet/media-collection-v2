export type SourceReply<T> =
    | { kind: 'found'; value: T }
    | { kind: 'none' }
    | { kind: 'limited'; retryAt: Date | null };

export interface LookupSource<T> {
    readonly name: string;
    readonly limit: { requests: number; seconds: number };
    find(isbn13: string): Promise<SourceReply<T>>;
}
