export type LibraryCounts = {
    ownedBooks: number;
    collections: number;
    bookcases: number;
    shelves: number;
    lentBooks: number;
};

export type RecentBook = {
    id: string;
    title: string;
    authors: string[];
    hasCover: boolean;
    updatedAt: string;
    read: boolean;
};

export type BookcaseSummary = { id: string; name: string; shelfCount: number };

export type ReadingSummary = { read: number; notRead: number };

export type OverviewView = LibraryCounts & {
    recentlyAdded: (Omit<RecentBook, 'read'> & { read: boolean | null })[];
    reading: ReadingSummary | null;
    bookcaseList: BookcaseSummary[];
};
