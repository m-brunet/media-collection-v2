import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';
import type { Isbn } from '../value-objects/isbn.value-object.js';
import type { Price } from '../value-objects/price.value-object.js';
import type { PublicationDate } from '../value-objects/publication-date.value-object.js';

export type BookCategory = 'books' | 'manga' | 'comics';
export type Ownership = 'owned' | 'not-owned';

// Shared edition information, as entered or corrected by an Owner or the administrator.
export interface BookDetails {
    title: string;
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

// One record per edition: the shared book information, independent of personal reading data.
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

    edit(details: BookDetails, now: string): void {
        this.state.details = Book.validate(details);
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
