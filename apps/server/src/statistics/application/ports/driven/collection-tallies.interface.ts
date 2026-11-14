export type CollectionTally = {
    id: string;
    name: string;
    category: 'books' | 'manga' | 'comics';
    finished: boolean;
    ownedBooks: number;
    missingVolumes: number;
};

export interface CollectionTallies {
    all(): Promise<CollectionTally[]>;
}
