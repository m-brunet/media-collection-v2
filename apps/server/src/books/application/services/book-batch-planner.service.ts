import type { AuthorMatch, OrganisationRequest } from '../book-input.js';
import type {
    BookBatchChanges,
    BookBatchEntry,
    BookBatchFillable,
    BookBatchFields,
    BookBatchRequest,
    BookBatchSkip,
    BookBatchSkipReason,
} from '../book-batch.js';
import { bookBatchDetailFields } from '../book-batch.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type {
    BookCollection,
    BookCollectionReader,
} from '../ports/driven/book-collection-reader.interface.js';
import type { BookLocation } from '../ports/driven/book-location-reader.interface.js';
import type { BookTag } from '../ports/driven/book-tag-reader.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import type { ShelfLocator } from '../ports/driven/shelf-locator.interface.js';
import type { TagFinder } from '../ports/driven/tag-finder.interface.js';
import type { BookIdentityCheck } from './book-identity-check.service.js';
import type { BookLoader } from './book-loader.service.js';
import type { BookOrganisationReader } from './book-organisation-reader.service.js';
import type { LentBookGuard } from './lent-book-guard.service.js';
import { Book } from '../../domain/entities/book.entity.js';
import type { BookDetails } from '../../domain/entities/book.entity.js';
import { Price } from '../../domain/value-objects/price.value-object.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface PlannedBook {
    book: Book;
    collection: BookCollection;
    entry: BookBatchEntry;
    detailsChanged: boolean;
    ownershipChanged: boolean;
    organisation: OrganisationRequest | null;
    read: boolean | null;
    previousAuthorIds: string[];
}

export interface BookBatchPlan {
    collection: { id: string; name: string };
    planned: PlannedBook[];
    skipped: BookBatchSkip[];
}

type BatchValues = {
    bookIds: readonly string[];
    changes: BookBatchChanges;
    authors: readonly AuthorMatch[] | null;
    price: Price | null;
    location: BookLocation | null;
    added: BookTag[];
    read: ReadonlySet<string>;
    now: string;
};

type Organised = {
    before: BookBatchFields;
    after: BookBatchFields;
    request: OrganisationRequest | null;
};

export class BookBatchPlanner {
    constructor(
        private readonly loader: BookLoader,
        private readonly memberships: BookCollectionReader,
        private readonly authors: AuthorRepository,
        private readonly organisation: BookOrganisationReader,
        private readonly shelves: ShelfLocator,
        private readonly tags: TagFinder,
        private readonly readings: ReadingStatusStore,
        private readonly guard: LentBookGuard,
        private readonly identity: BookIdentityCheck,
        private readonly clock: Clock,
    ) {}

    async plan(
        readerId: string,
        request: BookBatchRequest,
        authors: readonly AuthorMatch[] | null,
    ): Promise<BookBatchPlan> {
        const bookIds = [...new Set(request.bookIds)];

        Failure.ensure(bookIds.length > 0, 'Choose at least one book.', 'books-required');
        const members = await this.members(request.collectionId, bookIds);
        const { changes } = request;
        const values: BatchValues = {
            bookIds,
            changes,
            authors,
            price: changes.price?.trim() ? Price.parse(changes.price) : null,
            location: changes.shelfId ? await this.shelves.locate(changes.shelfId) : null,
            added: changes.tags ? await this.tags.find(changes.tags.add) : [],
            read:
                changes.read === undefined
                    ? new Set()
                    : await this.readings.readAmong(readerId, bookIds),
            now: this.clock.now().toISOString(),
        };
        const planned: PlannedBook[] = [];
        const skipped: BookBatchSkip[] = [];

        for (const { book, collection } of members) {
            const reason = await this.skipReason(book, values);
            const outcome = reason ? reason : await this.planBook(book, collection, values);

            if (typeof outcome === 'string') {
                skipped.push({ id: book.id, title: book.details.title, reason: outcome });
            } else {
                planned.push(outcome);
            }
        }

        return {
            collection: { id: request.collectionId, name: members[0]!.collection.name },
            planned,
            skipped,
        };
    }

    private async members(
        collectionId: string,
        bookIds: readonly string[],
    ): Promise<{ book: Book; collection: BookCollection }[]> {
        const members = [];

        for (const bookId of bookIds) {
            const book = await this.loader.load(bookId);
            const collection = await this.memberships.of(bookId);

            if (collection?.id !== collectionId) {
                throw new Failure(
                    'invalid_input',
                    'Every book of a batch must belong to its collection.',
                    'book-outside-collection',
                );
            }

            members.push({ book, collection });
        }

        return members;
    }

    private async skipReason(book: Book, values: BatchValues): Promise<BookBatchSkipReason | null> {
        const { changes } = values;
        const category = changes.category ?? book.details.category;

        if (changes.generatedTitles && !Book.generatesTitle(category)) {
            return 'title-not-generated';
        }

        if (
            changes.ownership === 'not-owned' &&
            book.details.ownership === 'owned' &&
            (await this.guard.isLent(book.id))
        ) {
            return 'book-lent';
        }

        return null;
    }

    private async planBook(
        book: Book,
        collection: BookCollection,
        values: BatchValues,
    ): Promise<PlannedBook | BookBatchSkipReason> {
        const previous = book.details;
        const next = this.nextDetails(previous, values);

        book.edit(next, values.now);

        if (values.changes.generatedTitles) {
            book.useGeneratedTitle(collection, values.now);
        }

        const current = book.details;

        if (
            current.authorIds.join('/') !== previous.authorIds.join('/') &&
            (await this.identity.hasPossibleDuplicate(current, values.bookIds))
        ) {
            return 'possible-duplicate';
        }

        const before = await this.detailFields(previous, null);
        const after = await this.detailFields(current, values.authors);
        const organised = await this.organised(book.id, values);
        const read = this.readChange(book.id, values);
        const entry = BookBatchPlanner.entry(book.id, previous.title, before, after);

        return {
            book,
            collection,
            entry: {
                ...entry,
                before: { ...entry.before, ...organised.before, ...read.before },
                after: { ...entry.after, ...organised.after, ...read.after },
            },
            detailsChanged: bookBatchDetailFields.some((field) => field in entry.after),
            ownershipChanged: current.ownership !== previous.ownership,
            organisation: organised.request,
            read: read.value,
            previousAuthorIds: previous.authorIds,
        };
    }

    private nextDetails(previous: BookDetails, values: BatchValues): BookDetails {
        const { changes } = values;
        const category = changes.category ?? previous.category;

        return {
            ...previous,
            category,
            titleGenerated: previous.titleGenerated && Book.generatesTitle(category),
            ownership: changes.ownership ?? previous.ownership,
            publisher:
                changes.publisher === undefined ||
                (BookBatchPlanner.fills(changes, 'publisher') && previous.publisher)
                    ? previous.publisher
                    : changes.publisher,
            price:
                changes.price === undefined ||
                (BookBatchPlanner.fills(changes, 'price') && previous.price)
                    ? previous.price
                    : values.price,
            authorIds: values.authors
                ? values.authors.map((author, index) => author.id ?? 'new-author-' + index)
                : previous.authorIds,
        };
    }

    private async detailFields(
        details: BookDetails,
        authors: readonly AuthorMatch[] | null,
    ): Promise<BookBatchFields> {
        return {
            title: details.title,
            titleGenerated: details.titleGenerated,
            category: details.category,
            ownership: details.ownership,
            publisher: details.publisher,
            priceCents: details.price?.cents ?? null,
            authors: authors ? authors.map((author) => author.name) : await this.names(details),
        };
    }

    private async names(details: BookDetails): Promise<string[]> {
        const found = await this.authors.findByIds(details.authorIds);

        return details.authorIds.map(
            (id) => found.find((author) => author.snapshot.id === id)?.snapshot.name ?? '',
        );
    }

    private async organised(bookId: string, values: BatchValues): Promise<Organised> {
        const { shelfId, tags } = values.changes;

        if (shelfId === undefined && tags === undefined) {
            return { before: {}, after: {}, request: null };
        }

        const current = await this.organisation.current(bookId);
        const before: BookBatchFields = {};
        const after: BookBatchFields = {};
        const request: OrganisationRequest = {};

        if (
            shelfId !== undefined &&
            !(BookBatchPlanner.fills(values.changes, 'shelfId') && current.location) &&
            (current.location?.shelfId ?? null) !== shelfId
        ) {
            before.location = current.location;
            after.location = values.location;
            request.shelfId = shelfId;
        }

        if (tags) {
            const removed = new Set(tags.remove);
            const kept = current.tags.filter((tag) => !removed.has(tag.id));
            const next = [
                ...kept,
                ...values.added.filter((tag) => !kept.some((known) => known.id === tag.id)),
            ].sort((first, second) =>
                NameKey.of(first.name).localeCompare(NameKey.of(second.name)),
            );

            if (BookBatchPlanner.tagKey(next) !== BookBatchPlanner.tagKey(current.tags)) {
                before.tags = current.tags;
                after.tags = next;
                request.tags = next.map((tag) => ({ id: tag.id }));
            }
        }

        return { before, after, request: Object.keys(request).length > 0 ? request : null };
    }

    private readChange(
        bookId: string,
        values: BatchValues,
    ): { before: BookBatchFields; after: BookBatchFields; value: boolean | null } {
        const read = values.changes.read;
        const wasRead = values.read.has(bookId);

        return read === undefined || read === wasRead
            ? { before: {}, after: {}, value: null }
            : { before: { read: wasRead }, after: { read }, value: read };
    }

    private static entry(
        id: string,
        title: string,
        before: BookBatchFields,
        after: BookBatchFields,
    ): BookBatchEntry {
        const changed = bookBatchDetailFields.filter(
            (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
        );

        return {
            id,
            title,
            before: Object.fromEntries(changed.map((field) => [field, before[field]])),
            after: Object.fromEntries(changed.map((field) => [field, after[field]])),
        };
    }

    private static fills(changes: BookBatchChanges, field: BookBatchFillable): boolean {
        return changes.onlyIfEmpty?.includes(field) ?? false;
    }

    private static tagKey(tags: readonly BookTag[]): string {
        return tags
            .map((tag) => tag.id)
            .toSorted()
            .join('/');
    }
}
