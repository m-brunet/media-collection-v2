import type {
    BookcaseSummary,
    LibraryCounts,
    ReadingSummary,
    RecentBook,
} from '../../overview-views.js';

export interface LibrarySummaryReader {
    counts(): Promise<LibraryCounts>;
    // Owned books, newest record first (by when the record was added), with `viewerId`'s status.
    recentlyAdded(limit: number, viewerId: string): Promise<RecentBook[]>;
    // `viewerId`'s Read and Not read counts over Owned books.
    reading(viewerId: string): Promise<ReadingSummary>;
    // Bookcases in name order with their shelf counts.
    bookcases(): Promise<BookcaseSummary[]>;
}
