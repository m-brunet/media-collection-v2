import type { BookCategory, Ownership } from '../domain/entities/book.entity.js';

// One author of a book being saved: an existing author, or a name to reuse or create.
// `distinct` confirms that a name similar to an existing author is really someone else.
export type AuthorChoice = { id: string } | { name: string; distinct?: boolean };

// Book information as entered in the form, before validation.
export interface BookInput {
    title: string;
    isbn: string | null;
    noIsbn: boolean;
    authors: AuthorChoice[];
    category: BookCategory;
    ownership: Ownership;
    publisher: string | null;
    publicationYear: number | null;
    publicationMonth: number | null;
    summary: string | null;
    pageCount: number | null;
    // As typed: comma or dot, at most two decimals; null when unknown.
    price: string | null;
    // Confirms a new no-ISBN book although a similar saved book was found.
    confirmDistinct?: boolean;
}
