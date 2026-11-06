// What a source answered for one ISBN: a value, nothing, or "not now" (its rate limit was reached;
// `retryAt` is when it accepts requests again, when it said so).
export type SourceReply<T> =
    | { kind: 'found'; value: T }
    | { kind: 'none' }
    | { kind: 'limited'; retryAt: Date | null };

// An outside source of book information or covers, asked by ISBN-13. It declares its published
// rate limit; the application keeps below it. A failure (unreachable, unexpected answer) throws.
export interface LookupSource<T> {
    readonly name: string;
    readonly limit: { requests: number; seconds: number };
    find(isbn13: string): Promise<SourceReply<T>>;
}
