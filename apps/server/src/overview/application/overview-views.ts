// Owned books are saved Owned edition records: an omnibus is one book, inferred volumes and Not
// Owned records are not counted.
export type LibraryCounts = {
    ownedBooks: number;
    collections: number;
    bookcases: number;
    shelves: number;
    lentBooks: number;
};

// `read` is the viewer's own status.
export type RecentBook = {
    id: string;
    title: string;
    authors: string[];
    hasCover: boolean;
    // The book's last change, which versions its cover address.
    updatedAt: string;
    read: boolean;
};

export type BookcaseSummary = { id: string; name: string; shelfCount: number };

export type ReadingSummary = { read: number; notRead: number };

export type OverviewView = LibraryCounts & {
    // `read` is null for a Guest, who has no personal reading display.
    recentlyAdded: (Omit<RecentBook, 'read'> & { read: boolean | null })[];
    // Null for a Guest.
    reading: ReadingSummary | null;
    bookcaseList: BookcaseSummary[];
};
