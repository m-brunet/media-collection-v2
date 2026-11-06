import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookCategory, Ownership } from '../../../domain/entities/book.entity.js';

// A book recorded earlier in another library (the V1 application), as it is to be saved here.
export type ImportedBook = {
    // Blank in a collection: Manga and Comics get a generated title; a Book, which never has one,
    // gets the same text (`Name Vol. N`) as a supplied title. Required outside a collection.
    title: string;
    // Null states that the edition has no ISBN.
    isbn: string | null;
    // Author names, reused by equivalent name; similar names are kept as distinct authors.
    authors: string[];
    category: BookCategory;
    ownership: Ownership;
    publisher: string | null;
    pageCount: number | null;
    // As typed in a form: comma or dot, at most two decimals.
    price: string | null;
    // The collection joined or created by name (similar names are distinct collections), with
    // the single volume the book is; volume 0 includes volume 0 in the collection.
    collection: { name: string; volume: number } | null;
    // When the book was first recorded in the other library (ISO 8601), kept as its creation date.
    createdAt: string;
    // The importing account's own reading status.
    read: boolean;
    // Image bytes; a cover that is not a usable JPEG, PNG or WebP image is left out.
    cover: Uint8Array | null;
};

export type ImportedBookOutcome = {
    bookId: string;
    // The title saved.
    title: string;
    collectionId: string | null;
    cover: 'stored' | 'none' | 'rejected';
};

export interface ImportBookUseCase {
    // Saves the book with its original creation date; the change itself is audited as made now
    // by the importing account.
    execute(actor: Actor, book: ImportedBook): Promise<ImportedBookOutcome>;
}
