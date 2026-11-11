import type {
    ImportBookUseCase,
    ImportedBook,
    ImportedBookOutcome,
} from '../ports/driving/import-book-use-case.interface.js';
import type { BookInput } from '../book-input.js';
import { BookAudit, BookSnapshot } from '../book-audit.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CollectionMembership } from '../ports/driven/collection-membership.interface.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import type { CoverTrimmer } from '../ports/driven/cover-trimmer.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import { BookDetailsBuilder } from '../services/book-details-builder.service.js';
import { BookIdentityCheck } from '../services/book-identity-check.service.js';
import { GeneratedTitleSync } from '../services/generated-title-sync.service.js';
import { Book } from '../../domain/entities/book.entity.js';
import { CoverImage } from '../../domain/value-objects/cover-image.value-object.js';
import { GeneratedTitle } from '../../domain/value-objects/generated-title.value-object.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class ImportBook implements ImportBookUseCase {
    constructor(
        private readonly books: BookRepository,
        private readonly builder: BookDetailsBuilder,
        private readonly identity: BookIdentityCheck,
        private readonly titles: GeneratedTitleSync,
        private readonly collections: CollectionMembership,
        private readonly readings: ReadingStatusStore,
        private readonly covers: CoverStorage,
        private readonly trimmer: CoverTrimmer,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, imported: ImportedBook): Promise<ImportedBookOutcome> {
        const cover = this.usableCover(imported.cover);
        let stored: string | null = null;

        try {
            return await this.operations.run(
                {
                    category: BookAudit.created,
                    actorId: actor.id,
                    subjectType: BookAudit.book,
                    subjectId: null,
                },
                async (context) => {
                    ActorAuthorization.requireLibraryEditor(actor);
                    const id = this.ids.next();
                    const now = this.clock.now().toISOString();
                    const input = this.input(imported);
                    const details = await this.builder.build(input);

                    this.ensureCreatedBefore(imported.createdAt, now);
                    await this.identity.ensureUnique(details, id, true);

                    if (cover) {
                        const trimmed = await this.trimmer.trim(cover);

                        stored = await this.covers.store(trimmed.bytes, trimmed.mediaType);
                    }

                    const book = new Book({
                        id,
                        details,
                        coverFile: stored,
                        createdAt: new Date(imported.createdAt).toISOString(),
                        updatedAt: now,
                    });

                    context.subjectId = id;
                    await this.books.create(book);
                    const membership = await this.collections.assign(
                        { id, ownership: details.ownership },
                        input.collection,
                        [],
                    );

                    await this.titles.apply(book, membership.collection, true);

                    if (imported.read) {
                        await this.readings.set(actor.id, id, true);
                    }

                    return {
                        result: {
                            bookId: id,
                            title: book.details.title,
                            collectionId: membership.collection?.id ?? null,
                            cover: cover ? 'stored' : imported.cover ? 'rejected' : 'none',
                        },
                        before: null,
                        after: BookSnapshot.of(book, { collection: membership.collection }),
                        related: membership.changes,
                    };
                },
            );
        } catch (error) {
            if (stored) {
                await this.covers.remove(stored);
            }

            throw error;
        }
    }

    private input(imported: ImportedBook): BookInput {
        return {
            title: ImportBook.title(imported),
            isbn: imported.isbn,
            noIsbn: imported.isbn === null,
            authors: imported.authors.map((name) => ({ name, distinct: true })),
            category: imported.category,
            ownership: imported.ownership,
            publisher: imported.publisher,
            publicationYear: null,
            publicationMonth: null,
            summary: null,
            pageCount: imported.pageCount,
            price: imported.price,
            collection: imported.collection && {
                collection: { name: imported.collection.name, distinct: true },
                volumeFrom: imported.collection.volume,
                volumeTo: imported.collection.volume,
                enableVolumeZero: imported.collection.volume === 0,
            },
            shelfId: null,
            tags: [],
        };
    }

    private static title(imported: ImportedBook): string {
        if (imported.title.trim() || imported.category !== 'books' || !imported.collection) {
            return imported.title;
        }

        const { name, volume } = imported.collection;

        return GeneratedTitle.of(name, volume, volume).text;
    }

    private usableCover(bytes: Uint8Array | null): CoverImage | null {
        if (!bytes) {
            return null;
        }

        try {
            return CoverImage.from(bytes);
        } catch (error) {
            // Justified: an unusable image only leaves the imported book without a cover.
            if (error instanceof Failure) {
                return null;
            }

            throw error;
        }
    }

    private ensureCreatedBefore(createdAt: string, now: string): void {
        const time = Date.parse(createdAt);

        Failure.ensure(
            !Number.isNaN(time) && time <= Date.parse(now),
            'The original creation date must be a past date.',
            'created-at-invalid',
        );
    }
}
