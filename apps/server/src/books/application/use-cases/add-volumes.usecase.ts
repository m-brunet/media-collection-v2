import type {
    AddVolumesUseCase,
    VolumeSkipReason,
    VolumesAdded,
    VolumesRequest,
    VolumeToAdd,
} from '../ports/driving/add-volumes-use-case.interface.js';
import { BookAudit } from '../book-audit.js';
import type { BookInput } from '../book-input.js';
import type { BookOrganisation } from '../book-views.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CollectionVolumes } from '../ports/driven/collection-volumes.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import type { BookCreation } from '../services/book-creation.service.js';
import type { BookLoader } from '../services/book-loader.service.js';
import type { BookOrganisationReader } from '../services/book-organisation-reader.service.js';
import type { Book } from '../../domain/entities/book.entity.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

type Anchor = { book: Book; organisation: BookOrganisation; read: boolean };

export class AddVolumes implements AddVolumesUseCase {
    constructor(
        private readonly collections: CollectionVolumes,
        private readonly loader: BookLoader,
        private readonly organisation: BookOrganisationReader,
        private readonly readings: ReadingStatusStore,
        private readonly books: BookRepository,
        private readonly creation: BookCreation,
        private readonly ids: IdGenerator,
        private readonly operations: AuditedOperation,
    ) {}

    execute(actor: Actor, request: VolumesRequest): Promise<VolumesAdded> {
        return this.operations.run(
            {
                category: BookAudit.volumesAdded,
                actorId: actor.id,
                subjectType: BookAudit.collection,
                subjectId: request.collectionId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const highest = Math.max(0, ...request.volumes.map((volume) => volume.volume));
                const collection = await this.collections.of(request.collectionId, highest);

                Failure.ensure(
                    collection.members.some((member) => member.bookId === request.anchorBookId),
                    'The volume the search started from is no longer in this collection.',
                    'anchor-outside-collection',
                );
                const anchor = await this.anchor(actor, request.anchorBookId);

                Failure.ensure(
                    anchor.book.details.category !== 'books' ||
                        request.volumes.every((volume) => volume.title?.trim()),
                    'Give every volume of a Books collection a title.',
                    'title-missing',
                );
                const free = new Set(collection.uncovered);
                const result: VolumesAdded = { added: [], skipped: [] };
                const related: RelatedChange[] = [];

                for (const volume of request.volumes) {
                    const isbn13 = Isbn.parse(volume.isbn).isbn13;
                    const reason = await this.refusal(volume.volume, isbn13, free);

                    if (reason) {
                        result.skipped.push({ volume: volume.volume, isbn: isbn13, reason });
                        continue;
                    }

                    free.delete(volume.volume);
                    const id = this.ids.next();
                    const created = await this.creation.create(
                        actor,
                        id,
                        AddVolumes.input(request.collectionId, volume, isbn13, anchor),
                        anchor.read,
                    );

                    result.added.push({
                        bookId: id,
                        volume: volume.volume,
                        title: created.book.details.title,
                    });
                    related.push(
                        {
                            category: BookAudit.created,
                            subjectType: BookAudit.book,
                            subjectId: id,
                            before: null,
                            after: created.after,
                        },
                        ...created.related,
                    );
                }

                return {
                    result,
                    before: null,
                    after: { name: collection.name, ...result },
                    related,
                };
            },
        );
    }

    private async anchor(actor: Actor, bookId: string): Promise<Anchor> {
        return {
            book: await this.loader.load(bookId),
            organisation: await this.organisation.current(bookId),
            read: await this.readings.isRead(actor.id, bookId),
        };
    }

    private async refusal(
        volume: number,
        isbn13: string,
        free: ReadonlySet<number>,
    ): Promise<VolumeSkipReason | null> {
        if (!free.has(volume)) {
            return 'volume-taken';
        }

        return (await this.books.findByIsbn(isbn13)) ? 'isbn-taken' : null;
    }

    private static input(
        collectionId: string,
        volume: VolumeToAdd,
        isbn13: string,
        anchor: Anchor,
    ): BookInput {
        const { details } = anchor.book;

        return {
            title: volume.title?.trim() ?? '',
            isbn: isbn13,
            noIsbn: false,
            authors:
                volume.authors.length > 0
                    ? volume.authors.map((name) => ({ name }))
                    : details.authorIds.map((id) => ({ id })),
            category: details.category,
            ownership: volume.ownership,
            publisher: details.publisher,
            publicationYear: volume.publicationYear,
            publicationMonth: null,
            summary: volume.summary,
            pageCount: volume.pageCount,
            price: null,
            collection: {
                collection: { id: collectionId },
                volumeFrom: volume.volume,
                volumeTo: volume.volume,
            },
            shelfId: anchor.organisation.location?.shelfId ?? null,
            tags: anchor.organisation.tags.map((tag) => ({ id: tag.id })),
        };
    }
}
