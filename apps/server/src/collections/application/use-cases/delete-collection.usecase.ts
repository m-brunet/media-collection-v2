import type { DeleteCollectionUseCase } from '../ports/driving/delete-collection-use-case.interface.js';
import { CollectionAudit, CollectionSnapshot } from '../collection-audit.js';
import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import type { MemberTitles } from '../ports/driven/member-titles.interface.js';
import { CollectionLoader } from '../services/collection-loader.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class DeleteCollection implements DeleteCollectionUseCase {
    constructor(
        private readonly collections: CollectionRepository,
        private readonly members: CollectionMemberStore,
        private readonly loader: CollectionLoader,
        private readonly titles: MemberTitles,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, collectionId: string): Promise<void> {
        await this.operations.run(
            {
                category: CollectionAudit.deleted,
                actorId: actor.id,
                subjectType: CollectionAudit.collection,
                subjectId: collectionId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const collection = await this.loader.load(collectionId);
                const records = await this.members.ofCollections([collectionId]);
                const kept = await this.titles.keep(records.map((record) => record.bookId));

                await this.members.clear(collectionId);
                await this.collections.delete(collectionId);

                return {
                    result: undefined,
                    before: {
                        ...CollectionSnapshot.of(collection),
                        bookIds: records.map((record) => record.bookId),
                    },
                    after: null,
                    related: kept,
                };
            },
        );
    }
}
