import type { BookcaseSizeName } from '../domain/value-objects/bookcase-size.value-object.js';

export interface ShelfView {
    id: string;
    bookcaseId: string;
    name: string;
    bookCount: number;
}

export interface BookcaseView {
    id: string;
    name: string;
    size: BookcaseSizeName;
    bookCount: number;
    shelves: ShelfView[];
}

export interface BookcaseChanges {
    name?: string;
    size?: BookcaseSizeName;
}

export interface ShelfChanges {
    name?: string;
    bookcaseId?: string;
}

export type SpineCategory = 'books' | 'manga' | 'comics';

export interface SpineBookView {
    id: string;
    title: string;
    authors: string[];
    category: SpineCategory;
    pageCount: number | null;
}

export interface ShelfSpinesView {
    shelfId: string;
    books: SpineBookView[];
}

export interface BookcaseSpinesView {
    bookcaseId: string;
    shelves: ShelfSpinesView[];
}
