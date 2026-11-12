import type { BookCollection } from './ports/driven/book-collection-reader.interface.js';
import type { BookOrganisation } from './book-views.js';
import type { Book } from '../domain/entities/book.entity.js';

export const BookAudit = {
    book: 'book',
    author: 'author',
    collection: 'collection',
    created: 'book.created',
    updated: 'book.updated',
    deleted: 'book.deleted',
    organised: 'book.organised',
    markedOwned: 'book.marked-owned',
    retitled: 'book.retitled',
    coverChanged: 'book.cover-changed',
    authorCorrected: 'author.corrected',
    readingStatusChanged: 'book.reading-status-changed',
    collectionReadingChanged: 'collection.reading-status-changed',
    batchEdited: 'collection.books-batch-edited',
    noteChanged: 'book.note-changed',
} as const;

export type SnapshotContext = {
    collection?: BookCollection | null;
    organisation?: BookOrganisation;
};

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

    static organisation(organisation: BookOrganisation): Record<string, unknown> {
        return {
            location: organisation.location,
            tags: organisation.tags.map((tag) => ({ ...tag })),
        };
    }
}
