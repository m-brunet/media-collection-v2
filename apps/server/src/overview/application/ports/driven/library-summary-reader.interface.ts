import type {
    BookcaseSummary,
    LibraryCounts,
    ReadingSummary,
    RecentBook,
} from '../../overview-views.js';

export interface LibrarySummaryReader {
    counts(): Promise<LibraryCounts>;
    recentlyAdded(limit: number, viewerId: string): Promise<RecentBook[]>;
    reading(viewerId: string): Promise<ReadingSummary>;
    bookcases(): Promise<BookcaseSummary[]>;
}
