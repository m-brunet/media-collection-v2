import type { AuthorChoice } from './book-input.js';
import type { BookLocation } from './ports/driven/book-location-reader.interface.js';
import type { BookTag } from './ports/driven/book-tag-reader.interface.js';
import type { Ownership } from '../domain/entities/book.entity.js';

export type BookBatchFillable = 'publisher' | 'price' | 'shelfId';

export interface BookBatchChanges {
    ownership?: Ownership;
    publisher?: string | null;
    price?: string | null;
    shelfId?: string | null;
    tags?: { add: readonly string[]; remove: readonly string[] };
    authors?: AuthorChoice[];
    read?: boolean;
    generatedTitles?: boolean;
    onlyIfEmpty?: readonly BookBatchFillable[];
}

export interface BookBatchRequest {
    collectionId: string;
    bookIds: readonly string[];
    changes: BookBatchChanges;
    preview: boolean;
}

export interface BookBatchFields {
    title?: string;
    titleGenerated?: boolean;
    ownership?: Ownership;
    publisher?: string | null;
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
    'priceCents',
    'authors',
];

export type BookBatchSkipReason = 'book-lent' | 'possible-duplicate' | 'title-not-generated';

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
    collection: { id: string; name: string };
    saved: boolean;
    books: BookBatchEntry[];
    skipped: BookBatchSkip[];
}
