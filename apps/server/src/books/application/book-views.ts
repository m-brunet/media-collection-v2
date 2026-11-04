import type { BookCategory, Ownership } from '../domain/entities/book.entity.js';

// Read models returned by the books use cases. Personal fields are null for Guests, who have no
// reading status or notes.

export interface AuthorView {
    id: string;
    name: string;
}

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
    // Account whose reading status is shown; null for Guests.
    readerId: string | null;
}

export interface BookListItem {
    id: string;
    title: string;
    authors: string[];
    category: BookCategory;
    ownership: Ownership;
    hasCover: boolean;
    updatedAt: string;
    read: boolean | null;
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
