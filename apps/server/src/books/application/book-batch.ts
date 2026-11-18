import type { AuthorChoice } from './book-input.js';
import type { BookLocation } from './ports/driven/book-location-reader.interface.js';
import type { BookTag } from './ports/driven/book-tag-reader.interface.js';
import type { Ownership } from '../domain/entities/book.entity.js';

export type BookBatchFillable = 'publisher' | 'publication' | 'price' | 'shelfId';

export interface BookBatchPublication {
    year: number;
    month: number | null;
}

export interface BookBatchChanges {
    ownership?: Ownership;
    publisher?: string | null;
    publication?: BookBatchPublication | null;
    price?: string | null;
    shelfId?: string | null;
    tags?: { add: readonly string[]; remove: readonly string[] };
    authors?: AuthorChoice[];
    read?: boolean;
    generatedTitles?: boolean;
    onlyIfEmpty?: readonly BookBatchFillable[];
}

export interface BookBatchRequest {
    collectionId: string | null;
    bookIds: readonly string[];
    changes: BookBatchChanges;
    preview: boolean;
}

export interface BookBatchFields {
    title?: string;
    titleGenerated?: boolean;
    ownership?: Ownership;
    publisher?: string | null;
    publication?: BookBatchPublication | null;
    priceCents?: number | null;
    authors?: string[];
    location?: BookLocation | null;
    tags?: BookTag[];
    read?: boolean;
}

export const bookBatchDetailFields: readonly (keyof BookBatchFields)[] = [
    'title',
    'titleGenerated',
    'ownership',
    'publisher',
    'publication',
    'priceCents',
    'authors',
];

export type BookBatchSkipReason =
    | 'book-lent'
    | 'possible-duplicate'
    | 'title-not-generated'
    | 'not-in-collection';

export interface BookBatchEntry {
    id: string;
    title: string;
    before: BookBatchFields;
    after: BookBatchFields;
}

export interface BookBatchSkip {
    id: string;
    title: string;
    reason: BookBatchSkipReason;
}

export interface BookBatchView {
    collection: { id: string; name: string } | null;
    saved: boolean;
    books: BookBatchEntry[];
    skipped: BookBatchSkip[];
}
