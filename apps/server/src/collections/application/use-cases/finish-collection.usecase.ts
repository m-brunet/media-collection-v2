import type { FinishCollectionUseCase } from '../ports/driving/finish-collection-use-case.interface.js';
import { CollectionAudit, CollectionSnapshot } from '../collection-audit.js';
import type { CollectionDetailsView } from '../collection-views.js';
import { MemberCoverage } from '../member-coverage.helper.js';
import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import { CollectionLoader } from '../services/collection-loader.service.js';
import { CollectionViewer } from '../services/collection-viewer.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class FinishCollection implements FinishCollectionUseCase {
    constructor(
        private readonly collections: CollectionRepository,
        private readonly members: CollectionMemberStore,
        private readonly loader: CollectionLoader,
        private readonly viewer: CollectionViewer,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, collectionId: string): Promise<CollectionDetailsView> {
        return this.operations.run(
            {
                category: CollectionAudit.finished,
                actorId: actor.id,
                subjectType: CollectionAudit.collection,
                subjectId: collectionId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const collection = await this.loader.load(collectionId);
                const before = CollectionSnapshot.of(collection);
                const records = await this.members.ofCollections([collectionId]);

                collection.finish(MemberCoverage.of(records), this.clock.now().toISOString());
                await this.collections.save(collection);

                return {
                    result: this.viewer.details(collection, records),
                    before,
                    after: CollectionSnapshot.of(collection),
                };
            },
        );
    }
}
