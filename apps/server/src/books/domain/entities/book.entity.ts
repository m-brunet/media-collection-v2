import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';
import type { Isbn } from '../value-objects/isbn.value-object.js';
import type { Price } from '../value-objects/price.value-object.js';
import type { PublicationDate } from '../value-objects/publication-date.value-object.js';
import { GeneratedTitle } from '../value-objects/generated-title.value-object.js';

export type BookCategory = 'books' | 'manga' | 'comics';
export type Ownership = 'owned' | 'not-owned';

export interface BookDetails {
    title: string;
    // True when the title was generated from the book's collection rather than supplied. Only
    // Manga and Comics in a collection may have one; it follows the collection's name and coverage.
    titleGenerated: boolean;
    // Exactly one of: an ISBN, or the explicit statement that the book has none.
    isbn: Isbn | null;
    noIsbn: boolean;
    authorIds: string[];
    category: BookCategory;
    ownership: Ownership;
    publisher: string | null;
    publicationDate: PublicationDate | null;
    summary: string | null;
    pageCount: number | null;
    price: Price | null;
}

export interface BookState {
    id: string;
    details: BookDetails;
    coverFile: string | null;
    createdAt: string;
    updatedAt: string;
}

const categories: readonly BookCategory[] = ['books', 'manga', 'comics'];
const ownerships: readonly Ownership[] = ['owned', 'not-owned'];

export class Book {
    private state: BookState;

    constructor(state: BookState) {
        this.state = { ...state, details: Book.validate(state.details) };
    }

    get id(): string {
        return this.state.id;
    }

    get snapshot(): BookState {
        return { ...this.state, details: { ...this.state.details } };
    }

    get details(): BookDetails {
        return { ...this.state.details, authorIds: [...this.state.details.authorIds] };
    }

    get titleKey(): string {
        return NameKey.of(this.state.details.title);
    }

    // Title order that compares numbers by value: "Gunnm - 2" before "Gunnm - 10".
    get titleSortKey(): string {
        return this.titleKey.replace(/\d+/g, (digits) => digits.padStart(10, '0'));
    }

    static generatesTitle(category: BookCategory): boolean {
        return category === 'manga' || category === 'comics';
    }

    regenerateTitle(
        collection: { name: string; volumeFrom: number; volumeTo: number },
        now: string,
    ): boolean {
        if (!this.state.details.titleGenerated) {
            return false;
        }

        const title = GeneratedTitle.of(
            collection.name,
            collection.volumeFrom,
            collection.volumeTo,
        ).text;

        if (title === this.state.details.title) {
            return false;
        }

        this.state.details = Book.validate({ ...this.state.details, title });
        this.state.updatedAt = now;

        return true;
    }

    // When its whole collection is deleted, a book keeps its last generated title as a supplied
    // one.
    keepTitle(now: string): boolean {
        if (!this.state.details.titleGenerated) {
            return false;
        }

        this.state.details = { ...this.state.details, titleGenerated: false };
        this.state.updatedAt = now;

        return true;
    }

    edit(details: BookDetails, now: string): void {
        this.state.details = Book.validate(details);
        this.state.updatedAt = now;
    }

    markOwned(now: string): void {
        if (this.state.details.ownership === 'owned') {
            throw new Failure('conflict', 'This book is already Owned.', 'book-already-owned');
        }

        this.state.details = { ...this.state.details, ownership: 'owned' };
        this.state.updatedAt = now;
    }

    replaceCover(file: string | null, now: string): void {
        this.state.coverFile = file;
        this.state.updatedAt = now;
    }

    private static validate(details: BookDetails): BookDetails {
        const title = details.title.trim();

        Failure.ensure(
            title.length >= 1 && title.length <= 300,
            'Enter a title of up to 300 characters.',
            'title-invalid',
        );
        Failure.ensure(
            details.noIsbn ? details.isbn === null : details.isbn !== null,
            'Enter the ISBN, or state that this book has no ISBN.',
            'isbn-required',
        );
        Failure.ensure(
            details.authorIds.length >= 1 &&
                new Set(details.authorIds).size === details.authorIds.length,
            'Add at least one author, each only once.',
            'authors-required',
        );
        Failure.ensure(categories.includes(details.category), 'Choose a category.');
        Failure.ensure(
            !details.titleGenerated || Book.generatesTitle(details.category),
            'Enter a title; only Manga and Comics in a collection get one automatically.',
            'title-required',
        );
        Failure.ensure(ownerships.includes(details.ownership), 'Choose Owned or Not Owned.');
        Failure.ensure(
            details.pageCount === null ||
                (Number.isInteger(details.pageCount) &&
                    details.pageCount >= 1 &&
                    details.pageCount <= 100000),
            'Enter the page count as a whole number above zero.',
            'page-count-invalid',
        );

        return {
            ...details,
            title,
            authorIds: [...details.authorIds],
            publisher: Book.optionalText(details.publisher, 200, 'publisher-invalid'),
            summary: Book.optionalText(details.summary, 5000, 'summary-invalid'),
        };
    }

    private static optionalText(
        value: string | null,
        limit: number,
        reason: string,
    ): string | null {
        const text = value?.trim() ?? '';

        Failure.ensure(text.length <= limit, 'This text is too long.', reason);

        return text.length > 0 ? text : null;
    }
}
