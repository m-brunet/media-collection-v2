import type { StatisticsCategory } from '../../../domain/services/collection-progress.service.js';
import type {
    AuthorCount,
    BookRecord,
    BookTotals,
    CategoryCounts,
    PublisherCounts,
    ReadingSplit,
} from '../../statistics-views.js';

export interface LibraryStatisticsReader {
    totals(category: StatisticsCategory | null): Promise<BookTotals>;
    categories(): Promise<CategoryCounts>;
    reading(viewerId: string, category: StatisticsCategory | null): Promise<ReadingSplit>;
    publishers(category: StatisticsCategory | null): Promise<PublisherCounts>;
    authors(category: StatisticsCategory | null): Promise<AuthorCount[]>;
    longest(category: StatisticsCategory | null): Promise<BookRecord | null>;
    mostExpensive(category: StatisticsCategory | null): Promise<BookRecord | null>;
}
