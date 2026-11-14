import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import type {
    CollectionTally,
    StatisticsCategory,
} from '../../domain/services/collection-progress.service.js';
import type { CollectionTallies } from '../ports/driven/collection-tallies.interface.js';
import type { LibraryStatisticsReader } from '../ports/driven/library-statistics-reader.interface.js';
import type {
    AuthorCount,
    BookRecord,
    BookTotals,
    CategoryCounts,
    PublisherCounts,
    ReadingSplit,
} from '../statistics-views.js';

export class StatisticsActors {
    static readonly owner = TestActors.of('owner', 'camille');
    static readonly guest = TestActors.of('guest', 'morgan');
    static readonly temporaryOwner = TestActors.of('owner', 'kim', true);
}

export class FixedLibraryStatistics implements LibraryStatisticsReader {
    readonly asked: (StatisticsCategory | null)[] = [];
    readonly readers: string[] = [];
    counted: BookTotals = {
        ownedBooks: 0,
        singleBooks: 0,
        pages: { total: 0, known: 0 },
        price: { totalCents: 0, known: 0 },
    };
    split: CategoryCounts = { books: 0, manga: 0, comics: 0 };
    read: ReadingSplit = { read: 0, notRead: 0 };
    published: PublisherCounts = { counts: [], without: 0 };
    written: AuthorCount[] = [];
    longestBook: BookRecord | null = null;
    dearestBook: BookRecord | null = null;

    async totals(category: StatisticsCategory | null): Promise<BookTotals> {
        this.asked.push(category);

        return this.counted;
    }

    async categories(): Promise<CategoryCounts> {
        return this.split;
    }

    async reading(viewerId: string): Promise<ReadingSplit> {
        this.readers.push(viewerId);

        return this.read;
    }

    async publishers(): Promise<PublisherCounts> {
        return this.published;
    }

    async authors(): Promise<AuthorCount[]> {
        return this.written;
    }

    async longest(): Promise<BookRecord | null> {
        return this.longestBook;
    }

    async mostExpensive(): Promise<BookRecord | null> {
        return this.dearestBook;
    }
}

export class FixedCollectionTallies implements CollectionTallies {
    readonly tallies: CollectionTally[] = [];

    add(name: string, tally: Partial<CollectionTally> = {}): this {
        this.tallies.push({
            id: 'collection-' + name.toLowerCase(),
            name,
            category: 'manga',
            finished: false,
            ownedBooks: 1,
            missingVolumes: 0,
            ...tally,
        });

        return this;
    }

    async all(): Promise<CollectionTally[]> {
        return this.tallies;
    }
}
