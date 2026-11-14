import type { BookInput } from '../book-input.js';
import { BookSnapshot } from '../book-audit.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CollectionMembership } from '../ports/driven/collection-membership.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import type { BookDetailsBuilder } from './book-details-builder.service.js';
import type { BookIdentityCheck } from './book-identity-check.service.js';
import type { BookOrganiser } from './book-organiser.service.js';
import type { BookRemoval, BookRemoved } from './book-removal.service.js';
import type { GeneratedTitleSync } from './generated-title-sync.service.js';
import { Book } from '../../domain/entities/book.entity.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';

export type CreatedBook = {
    book: Book;
    after: Record<string, unknown>;
    replaced: BookRemoved[];
    related: RelatedChange[];
};

export class BookCreation {
    constructor(
        private readonly books: BookRepository,
        private readonly builder: BookDetailsBuilder,
        private readonly identity: BookIdentityCheck,
        private readonly titles: GeneratedTitleSync,
        private readonly collections: CollectionMembership,
        private readonly removal: BookRemoval,
        private readonly organiser: BookOrganiser,
        private readonly readings: ReadingStatusStore,
        private readonly clock: Clock,
    ) {}

    async create(actor: Actor, id: string, input: BookInput, read: boolean): Promise<CreatedBook> {
        const now = this.clock.now().toISOString();
        const details = await this.builder.build(input);
        const replacing = input.replacePlanned ?? [];

        await this.identity.ensureUnique(details, id, input.confirmDistinct ?? false);
        const book = new Book({ id, details, coverFile: null, createdAt: now, updatedAt: now });

        await this.books.create(book);
        const membership = await this.collections.assign(
            { id, ownership: details.ownership, category: details.category },
            input.collection,
            replacing,
        );

        await this.titles.apply(book, membership.collection, input.confirmDistinct ?? false);
        const organised = await this.organiser.apply(id, {
            shelfId: input.shelfId,
            tags: input.tags,
        });
        const replaced: BookRemoved[] = [];

        for (const plannedId of replacing) {
            replaced.push(await this.removal.remove(plannedId));
        }

        if (read) {
            await this.readings.set(actor.id, id, true);
        }

        return {
            book,
            after: {
                ...BookSnapshot.of(book, {
                    collection: membership.collection,
                    organisation: organised.organisation,
                }),
                ...(replaced.length > 0
                    ? { replacedPlanned: replaced.map((planned) => BookSnapshot.of(planned.book)) }
                    : {}),
            },
            replaced,
            related: [
                ...membership.changes,
                ...organised.changes,
                ...replaced.flatMap((planned) => planned.changes),
            ],
        };
    }
}
