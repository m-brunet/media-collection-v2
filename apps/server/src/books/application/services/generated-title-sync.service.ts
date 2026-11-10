import type { BookCollection } from '../ports/driven/book-collection-reader.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import { BookIdentityCheck } from './book-identity-check.service.js';
import type { Book } from '../../domain/entities/book.entity.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';

export class GeneratedTitleSync {
    constructor(
        private readonly books: BookRepository,
        private readonly identity: BookIdentityCheck,
        private readonly clock: Clock,
    ) {}

    async apply(
        book: Book,
        collection: BookCollection | null,
        confirmDistinct: boolean,
    ): Promise<void> {
        if (!collection || !book.regenerateTitle(collection, this.clock.now().toISOString())) {
            return;
        }

        await this.identity.ensureUnique(book.details, book.id, confirmDistinct);
        await this.books.save(book);
    }
}
