export type CollectionTally = {
    id: string;
    name: string;
    category: 'books' | 'manga' | 'comics';
    status: 'unfinished' | 'finished' | 'dropped';
    ownedBooks: number;
    missingVolumes: number;
};

export interface CollectionTallies {
    all(): Promise<CollectionTally[]>;
}
