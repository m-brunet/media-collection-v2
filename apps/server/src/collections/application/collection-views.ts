import type { VolumeState } from '../domain/value-objects/collection-coverage.value-object.js';
import type { BookFilter } from '../../shared/application/book-filter.js';

// Read models returned by the collections use cases. Counts always describe the whole
// collection, whatever search found it.

export interface CollectionSummaryView {
    id: string;
    name: string;
    includesVolumeZero: boolean;
    finished: boolean;
    // Saved editions, not volumes.
    bookCount: number;
    // The expected sequence: from 0 or 1 to the highest saved coverage.
    expectedFrom: number;
    expectedTo: number;
    expectedCount: number;
    ownedCount: number;
    missingCount: number;
    lastOwned: number | null;
}

export interface MemberBookView {
    id: string;
    title: string;
    isbn: string | null;
    category: 'books' | 'manga' | 'comics';
    ownership: 'owned' | 'not-owned';
    hasCover: boolean;
    volumeFrom: number;
    volumeTo: number;
}

export interface VolumeView {
    from: number;
    to: number;
    state: VolumeState;
    books: MemberBookView[];
}

export interface CollectionDetailsView extends CollectionSummaryView {
    volumes: VolumeView[];
}

export interface CollectionListQuery {
    search: string;
    // Book-level criteria; counts still describe whole collections.
    filter: BookFilter;
    direction: 'asc' | 'desc';
    offset: number;
    limit: number;
}

export interface CollectionListPage {
    total: number;
    items: CollectionSummaryView[];
}

// A collection offered when choosing one for a book.
export interface CollectionNameView {
    id: string;
    name: string;
    includesVolumeZero: boolean;
}

export interface CollectionChanges {
    name?: string;
    includesVolumeZero?: boolean;
}
