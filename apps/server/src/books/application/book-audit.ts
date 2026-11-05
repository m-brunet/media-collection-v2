import type { BookCollection } from './ports/driven/book-collection-reader.interface.js';
import type { Book } from '../domain/entities/book.entity.js';

// Audit categories of the books feature. Shared changes are eligible for the Activity view
// (Task 8); personal reading and note changes never are, and note text is never recorded.
export const BookAudit = {
    book: 'book',
    author: 'author',
    created: 'book.created',
    updated: 'book.updated',
    deleted: 'book.deleted',
    coverChanged: 'book.cover-changed',
    authorCorrected: 'author.corrected',
    readingStatusChanged: 'book.reading-status-changed',
    noteChanged: 'book.note-changed',
} as const;

// Shared book information recorded before and after a change, with its collection membership
// when the change concerns it.
export class BookSnapshot {
    static of(book: Book, collection?: BookCollection | null): Record<string, unknown> {
        const { details, coverFile } = book.snapshot;

        return {
            title: details.title,
            isbn: details.isbn?.isbn13 ?? null,
            noIsbn: details.noIsbn,
            authorIds: [...details.authorIds],
            category: details.category,
            ownership: details.ownership,
            publisher: details.publisher,
            publicationYear: details.publicationDate?.year ?? null,
            publicationMonth: details.publicationDate?.month ?? null,
            summary: details.summary,
            pageCount: details.pageCount,
            priceCents: details.price?.cents ?? null,
            hasCover: coverFile !== null,
            ...(collection === undefined ? {} : { collection }),
        };
    }
}
