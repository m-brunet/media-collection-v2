import type {
    LastOwnedVolume,
    MissingVolume,
} from '../domain/services/collection-shopping.service.js';
import type { VolumeState } from '../domain/value-objects/collection-coverage.value-object.js';
import type { BookFilter } from '../../shared/application/book-filter.js';
import type { CollectionStatus } from '../domain/entities/collection.entity.js';

export interface CollectionSummaryView {
    id: string;
    name: string;
    category: 'books' | 'manga' | 'comics';
    includesVolumeZero: boolean;
    status: CollectionStatus;
    bookCount: number;
    expectedFrom: number;
    expectedTo: number;
    expectedCount: number;
    ownedCount: number;
    missingCount: number;
    lastOwned: number | null;
    previews: CollectionPreviewView[];
}

export interface CollectionPreviewView {
    id: string;
    title: string;
    updatedAt: string;
}

export interface MemberBookView {
    id: string;
    title: string;
    isbn: string | null;
    publisher: string | null;
    category: 'books' | 'manga' | 'comics';
    ownership: 'owned' | 'not-owned';
    hasCover: boolean;
    updatedAt: string;
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
    finished: boolean | null;
    dropped: boolean;
    filter: BookFilter;
    direction: 'asc' | 'desc';
    offset: number;
    limit: number;
}

export interface CollectionListPage {
    total: number;
    items: CollectionSummaryView[];
}

export interface CollectionNameView {
    id: string;
    name: string;
    category: 'books' | 'manga' | 'comics';
    includesVolumeZero: boolean;
}

export interface CollectionChanges {
    name?: string;
    category?: 'books' | 'manga' | 'comics';
    includesVolumeZero?: boolean;
}

export interface ShoppingCollectionView {
    id: string;
    name: string;
    expectedCount: number;
    ownedCount: number;
    missingCount: number;
    lastOwned: number | null;
}

export interface CollectionShoppingView {
    id: string;
    name: string;
    status: CollectionStatus;
    expectedCount: number;
    ownedCount: number;
    lastOwned: LastOwnedVolume | null;
    missing: MissingVolume[];
}
