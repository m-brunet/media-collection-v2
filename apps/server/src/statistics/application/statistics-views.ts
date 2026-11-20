import type { StatisticsCategory } from '../domain/services/collection-progress.service.js';

export type CategoryCounts = Record<StatisticsCategory, number>;

export type PagesCount = { pages: number; known: number };

export type CategoryPages = Record<StatisticsCategory, PagesCount>;

export type BookTotals = {
    ownedBooks: number;
    singleBooks: number;
    pages: { total: number; known: number };
    price: { totalCents: number; known: number };
};

export type ReadingSplit = {
    read: number;
    notRead: number;
    pages: { read: number; notRead: number; known: number };
};

export type PublisherCount = { name: string; books: number; pages: number };

export type PublisherCounts = { counts: PublisherCount[]; without: number };

export type AuthorCount = { name: string; books: number; pages: number };

export type BookRecord = { id: string; title: string; authors: string[]; value: number };

export type CollectionRecord = { id: string; name: string; ownedBooks: number };

export type StatisticsView = BookTotals & {
    categories: CategoryCounts;
    categoryPages: CategoryPages;
    reading: ReadingSplit | null;
    publishers: {
        byBooks: PublisherCount[];
        byPages: PublisherCount[];
        without: number;
        count: number;
    };
    authors: { byBooks: AuthorCount[]; byPages: AuthorCount[] };
    records: {
        longest: BookRecord | null;
        mostExpensive: BookRecord | null;
        biggestCollection: CollectionRecord | null;
    };
    collections: { finished: number; unfinished: number; dropped: number; missingVolumes: number };
};
