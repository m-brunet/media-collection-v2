import type { BookCollection } from './ports/driven/book-collection-reader.interface.js';
import type { BookLoan } from './ports/driven/book-loan-reader.interface.js';
import type { BookFilter } from '../../shared/application/book-filter.js';
import type { BookLocation } from './ports/driven/book-location-reader.interface.js';
import type { BookTag } from './ports/driven/book-tag-reader.interface.js';
import type { BookCategory, Ownership } from '../domain/entities/book.entity.js';

export interface AuthorView {
    id: string;
    name: string;
}

export type BookOrganisation = { location: BookLocation | null; tags: BookTag[] };

export interface BookView {
    id: string;
    title: string;
    titleGenerated: boolean;
    isbn: string | null;
    isbnConvertedFromIsbn10: boolean;
    noIsbn: boolean;
    authors: AuthorView[];
    category: BookCategory;
    ownership: Ownership;
    publisher: string | null;
    publicationYear: number | null;
    publicationMonth: number | null;
    summary: string | null;
    pageCount: number | null;
    priceCents: number | null;
    hasCover: boolean;
    collection: BookCollection | null;
    location: BookLocation | null;
    // Ordered by name.
    tags: BookTag[];
    loan: BookLoan | null;
    createdAt: string;
    updatedAt: string;
    // The viewer's own reading status and note; null for Guests.
    personal: { read: boolean; note: { text: string; updatedAt: string } | null } | null;
}

export type BookSort = 'title' | 'added' | 'published';

export interface BookListQuery {
    search: string;
    sort: BookSort;
    direction: 'asc' | 'desc';
    offset: number;
    limit: number;
    filter: BookFilter;
    // Account whose reading status is shown and filtered on; null for Guests.
    readerId: string | null;
}

export interface CatalogBookItem {
    id: string;
    title: string;
    authors: string[];
    category: BookCategory;
    ownership: Ownership;
    hasCover: boolean;
    collection: { name: string; volumeFrom: number; volumeTo: number } | null;
    updatedAt: string;
    read: boolean | null;
}

export interface CatalogPage {
    total: number;
    items: CatalogBookItem[];
}

export interface BookListItem extends CatalogBookItem {
    loan: BookLoan | null;
}

export interface BookListPage {
    total: number;
    items: BookListItem[];
}

export interface DuplicateCandidate {
    id: string;
    title: string;
    authors: string[];
}
