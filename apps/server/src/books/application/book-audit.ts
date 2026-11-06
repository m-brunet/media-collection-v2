import type { BookCollection } from './ports/driven/book-collection-reader.interface.js';
import type { BookOrganisation } from './book-views.js';
import type { Book } from '../domain/entities/book.entity.js';

// Audit categories of the books feature. Shared changes are eligible for the Activity view
// (Task 8); personal reading and note changes never are, and note text is never recorded.
export const BookAudit = {
    book: 'book',
    author: 'author',
    created: 'book.created',
    updated: 'book.updated',
    deleted: 'book.deleted',
    organised: 'book.organised',
    // A title changed by a collection-wide operation (rename or deletion of its collection).
    retitled: 'book.retitled',
    coverChanged: 'book.cover-changed',
    authorCorrected: 'author.corrected',
    readingStatusChanged: 'book.reading-status-changed',
    noteChanged: 'book.note-changed',
} as const;

// What a change concerns besides the book information: its collection membership, location
// and tags.
export type SnapshotContext = {
    collection?: BookCollection | null;
    organisation?: BookOrganisation;
};

// Shared book information recorded before and after a change, with the membership, location
// and tags the change concerns.
export class BookSnapshot {
    static of(book: Book, context: SnapshotContext = {}): Record<string, unknown> {
        const { collection, organisation } = context;
        const { details, coverFile } = book.snapshot;

        return {
            title: details.title,
            titleGenerated: details.titleGenerated,
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
            ...(organisation === undefined ? {} : BookSnapshot.organisation(organisation)),
        };
    }

    // Location and tags of a book, as recorded when only they change.
    static organisation(organisation: BookOrganisation): Record<string, unknown> {
        return {
            location: organisation.location,
            tags: organisation.tags.map((tag) => ({ ...tag })),
        };
    }
}
