import type { UpdateCollectionUseCase } from '../ports/driving/update-collection-use-case.interface.js';
import { CollectionAudit, CollectionSnapshot } from '../collection-audit.js';
import type { CollectionChanges, CollectionDetailsView } from '../collection-views.js';
import { MemberCoverage } from '../member-coverage.helper.js';
import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import type { MemberTitles } from '../ports/driven/member-titles.interface.js';
import type { MemberCategories } from '../ports/driven/member-categories.interface.js';
import { CollectionLoader } from '../services/collection-loader.service.js';
import { CollectionViewer } from '../services/collection-viewer.service.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export class UpdateCollection implements UpdateCollectionUseCase {
    constructor(
        private readonly collections: CollectionRepository,
        private readonly members: CollectionMemberStore,
        private readonly loader: CollectionLoader,
        private readonly viewer: CollectionViewer,
        private readonly titles: MemberTitles,
        private readonly categories: MemberCategories,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(
        actor: Actor,
        collectionId: string,
        changes: CollectionChanges,
    ): Promise<CollectionDetailsView> {
        return this.operations.run(
            {
                category: CollectionAudit.updated,
                actorId: actor.id,
                subjectType: CollectionAudit.collection,
                subjectId: collectionId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const collection = await this.loader.load(collectionId);
                const before = CollectionSnapshot.of(collection);
                const records = await this.members.ofCollections([collectionId]);
                const members = MemberCoverage.of(records);
                const now = this.clock.now().toISOString();
                let retitled: RelatedChange[] = [];
                let recategorised: RelatedChange[] = [];

                if (changes.name !== undefined) {
                    await this.ensureAvailable(collectionId, changes.name);
                    collection.rename(changes.name, now);
                    retitled = await this.titles.regenerate(
                        collection.snapshot.name,
                        records.map(({ bookId, volumeFrom, volumeTo }) => ({
                            bookId,
                            volumeFrom,
                            volumeTo,
                        })),
                    );
                }

                if (changes.includesVolumeZero !== undefined) {
                    collection.changeVolumeZero(changes.includesVolumeZero, members, now);
                    collection.reconcile(members, now);
                }

                if (
                    changes.category !== undefined &&
                    changes.category !== collection.snapshot.category
                ) {
                    collection.changeCategory(changes.category, now);
                    recategorised = await this.categories.change(
                        changes.category,
                        records.map((record) => record.bookId),
                    );
                }

                await this.collections.save(collection);

                return {
                    result: this.viewer.details(collection, records),
                    before,
                    after: CollectionSnapshot.of(collection),
                    related: [...retitled, ...recategorised],
                };
            },
        );
    }

    private async ensureAvailable(collectionId: string, name: string): Promise<void> {
        const equivalent = await this.collections.findByKey(NameKey.of(name));

        if (equivalent && equivalent.id !== collectionId) {
            throw new Failure(
                'conflict',
                'Another collection already has this name.',
                'collection-name-taken',
            );
        }
    }
}
