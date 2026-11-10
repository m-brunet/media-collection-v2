import type { DeleteTagUseCase } from '../ports/driving/delete-tag-use-case.interface.js';
import { TagAudit, TagSnapshot } from '../tag-audit.js';
import type { BookTagStore } from '../ports/driven/book-tag-store.interface.js';
import type { TagRepository } from '../ports/driven/tag-repository.interface.js';
import { TagLoader } from '../services/tag-loader.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class DeleteTag implements DeleteTagUseCase {
    constructor(
        private readonly tags: TagRepository,
        private readonly store: BookTagStore,
        private readonly loader: TagLoader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, tagId: string): Promise<void> {
        await this.operations.run(
            {
                category: TagAudit.deleted,
                actorId: actor.id,
                subjectType: TagAudit.tag,
                subjectId: tagId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const tag = await this.loader.load(tagId);
                const counts = await this.store.countByTag();

                await this.tags.delete(tagId);

                return {
                    result: undefined,
                    before: { ...TagSnapshot.of(tag), untaggedBooks: counts.get(tagId) ?? 0 },
                    after: null,
                };
            },
        );
    }
}
