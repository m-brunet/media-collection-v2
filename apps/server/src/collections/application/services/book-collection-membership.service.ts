import { CollectionAudit, CollectionChange } from '../collection-audit.js';
import { MemberCoverage } from '../member-coverage.helper.js';
import type {
    CollectionMemberStore,
    MemberRecord,
} from '../ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import { CollectionLoader } from './collection-loader.service.js';
import { CollectionUpkeep } from './collection-upkeep.service.js';
import type {
    BookCollection,
    BookCollectionReader,
} from '../../../books/application/ports/driven/book-collection-reader.interface.js';
import type {
    CollectionChoice,
    CollectionMembership,
    MemberBook,
    MembershipOutcome,
    MembershipRequest,
} from '../../../books/application/ports/driven/collection-membership.interface.js';
import { Collection } from '../../domain/entities/collection.entity.js';
import type { CoverageMember } from '../../domain/value-objects/collection-coverage.value-object.js';
import { VolumeRange } from '../../domain/value-objects/volume-range.value-object.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

// Applies the collection rules to the books feature's saves: a name joins or creates its
// collection, volume 0 needs the collection option, and coverage may overlap only between
// Owned books. Nothing is trimmed, split or deleted without the person's explicit choice.
export class BookCollectionMembership implements CollectionMembership, BookCollectionReader {
    constructor(
        private readonly collections: CollectionRepository,
        private readonly members: CollectionMemberStore,
        private readonly loader: CollectionLoader,
        private readonly upkeep: CollectionUpkeep,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async assign(
        book: MemberBook,
        request: MembershipRequest | null,
        replacing: readonly string[],
    ): Promise<MembershipOutcome> {
        const now = this.clock.now().toISOString();
        const previous = await this.members.ofBook(book.id);

        if (!request) {
            this.ensureNothingReplaced(replacing);

            return { collection: null, changes: previous ? await this.leave(book.id) : [] };
        }

        const range = VolumeRange.of(request.volumeFrom, request.volumeTo);
        const { collection, created } = await this.resolve(request.collection, now);
        const before = created ? null : new Collection(collection.snapshot);

        if (range.covers(0) && !collection.snapshot.includesVolumeZero) {
            if (!request.enableVolumeZero) {
                throw new Failure(
                    'conflict',
                    'Volume 0 is only possible once the collection includes it.',
                    'volume-zero-disabled',
                    { name: collection.snapshot.name },
                );
            }

            collection.changeVolumeZero(true, [], now);
        }

        const records = created ? [] : await this.members.ofCollections([collection.id]);

        this.ensureNoConflict(
            collection,
            records,
            { bookId: book.id, ownership: book.ownership, range },
            replacing,
        );
        await (created ? this.collections.create(collection) : this.collections.save(collection));
        await this.members.place(book.id, collection.id, range.from, range.to);
        const changes = [this.change(collection, before)];

        if (previous && previous.collectionId !== collection.id) {
            changes.push(await this.upkeep.tidy(previous.collectionId, now));
        }

        changes.push(await this.upkeep.tidy(collection.id, now));

        return {
            collection: {
                id: collection.id,
                name: collection.snapshot.name,
                volumeFrom: range.from,
                volumeTo: range.to,
            },
            changes: changes.filter((change) => change !== null),
        };
    }

    async leave(bookId: string): Promise<RelatedChange[]> {
        const previous = await this.members.ofBook(bookId);

        if (!previous) {
            return [];
        }

        await this.members.remove(bookId);
        const change = await this.upkeep.tidy(
            previous.collectionId,
            this.clock.now().toISOString(),
        );

        return change ? [change] : [];
    }

    async of(bookId: string): Promise<BookCollection | null> {
        const record = await this.members.ofBook(bookId);
        const collection = record ? await this.collections.findById(record.collectionId) : null;

        return record && collection
            ? {
                  id: collection.id,
                  name: collection.snapshot.name,
                  volumeFrom: record.volumeFrom,
                  volumeTo: record.volumeTo,
              }
            : null;
    }

    private change(collection: Collection, before: Collection | null): RelatedChange | null {
        if (!before) {
            return CollectionChange.of(CollectionAudit.created, collection.id, null, collection);
        }

        return before.snapshot.includesVolumeZero === collection.snapshot.includesVolumeZero
            ? null
            : CollectionChange.of(CollectionAudit.updated, collection.id, before, collection);
    }

    // An equivalent name joins its collection; a similar one is only created once the person
    // confirms it is another collection.
    private async resolve(
        choice: CollectionChoice,
        now: string,
    ): Promise<{ collection: Collection; created: boolean }> {
        if ('id' in choice) {
            return { collection: await this.loader.load(choice.id), created: false };
        }

        const name = Collection.validName(choice.name);
        const equivalent = await this.collections.findByKey(NameKey.of(name));

        if (equivalent) {
            return { collection: equivalent, created: false };
        }

        if (!choice.distinct) {
            const similar = (await this.collections.list()).filter((collection) =>
                NameKey.similar(collection.snapshot.name, name),
            );

            if (similar.length > 0) {
                throw new Failure(
                    'conflict',
                    'A similar collection already exists.',
                    'collection-similar',
                    {
                        name,
                        candidates: similar.map((collection) => ({
                            id: collection.id,
                            name: collection.snapshot.name,
                        })),
                    },
                );
            }
        }

        return {
            collection: new Collection({
                id: this.ids.next(),
                name,
                includesVolumeZero: false,
                finished: false,
                createdAt: now,
                updatedAt: now,
            }),
            created: true,
        };
    }

    // An Owned book may replace the planned (Not Owned) books it overlaps, only when the person
    // chose to delete exactly those books.
    private ensureNoConflict(
        collection: Collection,
        records: readonly MemberRecord[],
        candidate: CoverageMember,
        replacing: readonly string[],
    ): void {
        const members = MemberCoverage.of(records);
        const conflicts = collection.coverage(members).conflictsWith(candidate);

        if (conflicts.length === 0) {
            this.ensureNothingReplaced(replacing);

            return;
        }

        const ids = conflicts.map((conflict) => conflict.bookId);
        const replaceable =
            candidate.ownership === 'owned' &&
            conflicts.every((conflict) => conflict.ownership === 'not-owned');

        if (
            replaceable &&
            replacing.length === ids.length &&
            ids.every((id) => replacing.includes(id))
        ) {
            return;
        }

        const remaining = collection.coverage([
            ...members.filter((member) => !ids.includes(member.bookId)),
            candidate,
        ]);

        throw new Failure(
            'conflict',
            'This coverage overlaps a planned book of the collection.',
            'coverage-conflict',
            {
                name: collection.snapshot.name,
                conflicts: records
                    .filter((record) => ids.includes(record.bookId))
                    .map((record) => ({
                        id: record.bookId,
                        title: record.title,
                        isbn: record.isbn,
                        ownership: record.ownership,
                        volumeFrom: record.volumeFrom,
                        volumeTo: record.volumeTo,
                    })),
                replaceable,
                expectedAfterReplacement: replaceable
                    ? { from: remaining.start, to: remaining.highest }
                    : null,
            },
        );
    }

    private ensureNothingReplaced(replacing: readonly string[]): void {
        if (replacing.length > 0) {
            throw new Failure(
                'conflict',
                'The planned books changed meanwhile; review the collection again.',
                'replacement-outdated',
            );
        }
    }
}
