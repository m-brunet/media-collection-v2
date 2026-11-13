import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { MemberTitles, TitledMember } from '../ports/driven/member-titles.interface.js';
import type { MemberCategories } from '../ports/driven/member-categories.interface.js';
import type { CollectionCategory } from '../../domain/entities/collection.entity.js';
import type { CollectionBookSearch } from '../ports/driven/collection-book-search.interface.js';
import { BookFilter } from '../../../shared/application/book-filter.js';
import type {
    CollectionMemberStore,
    MemberRecord,
} from '../ports/driven/collection-member-store.interface.js';
import type {
    CollectionPageQuery,
    CollectionRepository,
} from '../ports/driven/collection-repository.interface.js';
import { MemberCoverage } from '../member-coverage.helper.js';
import { CollectionLoader } from '../services/collection-loader.service.js';
import { CollectionUpkeep } from '../services/collection-upkeep.service.js';
import { CollectionViewer } from '../services/collection-viewer.service.js';
import { BookCollectionMembership } from '../services/book-collection-membership.service.js';
import { Collection } from '../../domain/entities/collection.entity.js';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { Required } from '../../../shared/domain/required.helper.js';

export class MemoryCollections implements CollectionRepository {
    readonly collections = new Map<string, Collection>();

    async findById(id: string): Promise<Collection | null> {
        const collection = this.collections.get(id);

        return collection ? new Collection(collection.snapshot) : null;
    }

    async findByKey(key: string): Promise<Collection | null> {
        const collection = [...this.collections.values()].find((value) => value.key === key);

        return collection ? new Collection(collection.snapshot) : null;
    }

    async list(): Promise<Collection[]> {
        return [...this.collections.values()]
            .sort((first, second) => first.key.localeCompare(second.key))
            .map((collection) => new Collection(collection.snapshot));
    }

    async page(query: CollectionPageQuery): Promise<{ total: number; collections: Collection[] }> {
        const selected = (await this.list()).filter(
            (collection) => query.ids === null || query.ids.includes(collection.id),
        );
        const ordered = query.direction === 'asc' ? selected : selected.reverse();

        return {
            total: ordered.length,
            collections: ordered.slice(query.offset, query.offset + query.limit),
        };
    }

    async create(collection: Collection): Promise<void> {
        if (await this.findByKey(collection.key)) {
            throw new Failure('conflict', 'Equivalent collection', 'collection-name-taken');
        }

        this.collections.set(collection.id, new Collection(collection.snapshot));
    }

    async save(collection: Collection): Promise<void> {
        this.collections.set(collection.id, new Collection(collection.snapshot));
    }

    async delete(id: string): Promise<void> {
        this.collections.delete(id);
    }
}

type SavedBook = Pick<
    MemberRecord,
    'title' | 'isbn' | 'publisher' | 'category' | 'ownership' | 'hasCover' | 'updatedAt'
>;

export class MemoryMembers implements CollectionMemberStore {
    readonly books = new Map<string, SavedBook>();
    readonly memberships = new Map<
        string,
        { collectionId: string; volumeFrom: number; volumeTo: number }
    >();

    saveBook(
        id: string,
        ownership: MemberRecord['ownership'],
        title = 'Book ' + id,
        details: Partial<SavedBook> = {},
    ): void {
        this.books.set(id, {
            title,
            isbn: null,
            publisher: null,
            category: 'comics',
            ownership,
            hasCover: false,
            updatedAt: '2026-01-01T00:00:00.000Z',
            ...details,
        });
    }

    async ofBook(bookId: string): Promise<MemberRecord | null> {
        return this.records().find((record) => record.bookId === bookId) ?? null;
    }

    async ofCollections(collectionIds: readonly string[]): Promise<MemberRecord[]> {
        return this.records()
            .filter((record) => collectionIds.includes(record.collectionId))
            .sort(
                (first, second) =>
                    first.volumeFrom - second.volumeFrom || first.volumeTo - second.volumeTo,
            );
    }

    async place(
        bookId: string,
        collectionId: string,
        volumeFrom: number,
        volumeTo: number,
    ): Promise<void> {
        this.memberships.set(bookId, { collectionId, volumeFrom, volumeTo });
    }

    async remove(bookId: string): Promise<void> {
        this.memberships.delete(bookId);
    }

    async clear(collectionId: string): Promise<void> {
        for (const [bookId, membership] of this.memberships) {
            if (membership.collectionId === collectionId) {
                this.memberships.delete(bookId);
            }
        }
    }

    private records(): MemberRecord[] {
        return [...this.memberships].map(([bookId, membership]) => ({
            bookId,
            ...membership,
            ...Required.value(this.books.get(bookId), 'book ' + bookId + ' is known to the double'),
        }));
    }
}

export class FixedBookSearch implements CollectionBookSearch {
    matches: string[] = [];
    readonly calls: { search: string; filter: BookFilter; readerId: string | null }[] = [];

    async collectionsMatching(
        search: string,
        filter: BookFilter,
        readerId: string | null,
    ): Promise<string[]> {
        this.calls.push({ search, filter, readerId });

        return this.matches;
    }
}

export const anyBook = BookFilter.of();

export class RecordedMemberTitles implements MemberTitles {
    readonly regenerated: { collectionName: string; members: TitledMember[] }[] = [];
    readonly kept: string[][] = [];

    async regenerate(
        collectionName: string,
        members: readonly TitledMember[],
    ): Promise<RelatedChange[]> {
        this.regenerated.push({
            collectionName,
            members: members.map((member) => ({ ...member })),
        });

        return members.map((member) => ({
            category: 'book.retitled',
            subjectType: 'book',
            subjectId: member.bookId,
            before: null,
            after: { collectionName },
        }));
    }

    async keep(bookIds: readonly string[]): Promise<RelatedChange[]> {
        this.kept.push([...bookIds]);

        return [];
    }
}

export class RecordedMemberCategories implements MemberCategories {
    readonly changed: { category: CollectionCategory; bookIds: string[] }[] = [];

    async change(
        category: CollectionCategory,
        bookIds: readonly string[],
    ): Promise<RelatedChange[]> {
        this.changed.push({ category, bookIds: [...bookIds] });

        return bookIds.map((bookId) => ({
            category: 'book.category-changed',
            subjectType: 'book',
            subjectId: bookId,
            before: null,
            after: { category },
        }));
    }
}

export class CollectionDoubles {
    static shelf() {
        const collections = new MemoryCollections();
        const members = new MemoryMembers();
        const trail = new MemoryAuditTrail();
        const loader = new CollectionLoader(collections);
        const upkeep = new CollectionUpkeep(collections, members);
        let counter = 0;
        const ids = { next: () => 'collection-' + ++counter };
        const clock = { now: () => new Date('2026-03-01T10:00:00Z') };

        return {
            collections,
            members,
            trail,
            loader,
            upkeep,
            ids,
            clock,
            search: new FixedBookSearch(),
            titles: new RecordedMemberTitles(),
            categories: new RecordedMemberCategories(),
            viewer: new CollectionViewer(),
            operations: AuditDoubles.auditedOperation(trail),
            membership: new BookCollectionMembership(
                collections,
                members,
                loader,
                upkeep,
                ids,
                clock,
            ),
        };
    }

    static async member(
        current: ReturnType<typeof CollectionDoubles.shelf>,
        bookId: string,
        ownership: MemberRecord['ownership'],
        collection: string,
        volumeFrom: number,
        volumeTo = volumeFrom,
    ) {
        current.members.saveBook(bookId, ownership);

        return current.membership.assign(
            { id: bookId, ownership, category: 'comics' },
            { collection: { name: collection }, volumeFrom, volumeTo, enableVolumeZero: true },
            [],
        );
    }

    static async markFinished(
        current: ReturnType<typeof CollectionDoubles.shelf>,
        collectionId: string,
    ) {
        const collection = Required.value(
            await current.collections.findById(collectionId),
            'collection ' + collectionId + ' exists',
        );
        const records = await current.members.ofCollections([collectionId]);

        collection.finish(MemberCoverage.of(records), '2026-01-01T00:00:00.000Z');
        await current.collections.save(collection);
    }
}

export const owner = TestActors.of('owner', 'camille');
export const guest = TestActors.of('guest', 'morgan');
