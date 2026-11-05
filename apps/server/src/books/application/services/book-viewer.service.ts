import type { BookView } from '../book-views.js';
import type { BookCatalog } from '../ports/driven/book-catalog.interface.js';
import type { BookCollectionReader } from '../ports/driven/book-collection-reader.interface.js';
import type { PersonalNoteStore } from '../ports/driven/personal-note-store.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import { BookOrganisationReader } from './book-organisation-reader.service.js';
import type { Book } from '../../domain/entities/book.entity.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';

// The details of a book as one account sees them: shared information, plus that account's own
// reading status and note (never another account's; Guests have neither).
export class BookViewer {
    constructor(
        private readonly catalog: BookCatalog,
        private readonly readings: ReadingStatusStore,
        private readonly notes: PersonalNoteStore,
        private readonly collections: BookCollectionReader,
        private readonly organisation: BookOrganisationReader,
    ) {}

    async view(book: Book, actor: Actor): Promise<BookView> {
        const { id, details, coverFile, createdAt, updatedAt } = book.snapshot;
        const { location, tags } = await this.organisation.current(id);

        return {
            id,
            title: details.title,
            isbn: details.isbn?.isbn13 ?? null,
            isbnConvertedFromIsbn10: details.isbn?.convertedFromIsbn10 ?? false,
            noIsbn: details.noIsbn,
            authors: await this.catalog.authorsOf(id),
            category: details.category,
            ownership: details.ownership,
            publisher: details.publisher,
            publicationYear: details.publicationDate?.year ?? null,
            publicationMonth: details.publicationDate?.month ?? null,
            summary: details.summary,
            pageCount: details.pageCount,
            priceCents: details.price?.cents ?? null,
            hasCover: coverFile !== null,
            collection: await this.collections.of(id),
            location,
            tags,
            createdAt,
            updatedAt,
            personal:
                actor.role === 'guest'
                    ? null
                    : {
                          read: await this.readings.isRead(actor.id, id),
                          note: await this.notes.find(actor.id, id),
                      },
        };
    }
}
