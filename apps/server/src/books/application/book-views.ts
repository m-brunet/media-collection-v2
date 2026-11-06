import type { BookCollection } from './ports/driven/book-collection-reader.interface.js';
import type { BookLoan } from './ports/driven/book-loan-reader.interface.js';
import type { BookFilter } from '../../shared/application/book-filter.js';
import type { BookLocation } from './ports/driven/book-location-reader.interface.js';
import type { BookTag } from './ports/driven/book-tag-reader.interface.js';
import type { BookCategory, Ownership } from '../domain/entities/book.entity.js';

// Read models returned by the books use cases. Personal fields are null for Guests, who have no
// reading status or notes.

export interface AuthorView {
    id: string;
    name: string;
}

// Where a book is kept and how it is tagged.
export type BookOrganisation = { location: BookLocation | null; tags: BookTag[] };

export interface BookView {
    id: string;
    title: string;
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
    // The active loan, if the book is currently lent.
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

// A book of the list as the catalog finds it.
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

// A book of the list with its active loan, for the Lent indicator.
export interface BookListItem extends CatalogBookItem {
    loan: BookLoan | null;
}

export interface BookListPage {
    total: number;
    items: BookListItem[];
}

// A saved book a new no-ISBN book may duplicate, offered so the person can decide.
export interface DuplicateCandidate {
    id: string;
    title: string;
    authors: string[];
}
