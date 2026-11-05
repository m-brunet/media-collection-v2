import type { RenameTagUseCase } from '../ports/driving/rename-tag-use-case.interface.js';
import { TagAudit, TagSnapshot } from '../tag-audit.js';
import type { TagView } from '../tag-views.js';
import type { BookTagStore } from '../ports/driven/book-tag-store.interface.js';
import type { TagRepository } from '../ports/driven/tag-repository.interface.js';
import { TagLoader } from '../services/tag-loader.service.js';
import { TagNaming } from '../services/tag-naming.service.js';
import { TagViewer } from '../services/tag-viewer.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// The identity and assignments stay; only the shared label changes.
export class RenameTag implements RenameTagUseCase {
    constructor(
        private readonly tags: TagRepository,
        private readonly store: BookTagStore,
        private readonly loader: TagLoader,
        private readonly naming: TagNaming,
        private readonly viewer: TagViewer,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, tagId: string, name: string): Promise<TagView> {
        return this.operations.run(
            {
                category: TagAudit.renamed,
                actorId: actor.id,
                subjectType: TagAudit.tag,
                subjectId: tagId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const tag = await this.loader.load(tagId);
                const before = TagSnapshot.of(tag);

                await this.naming.ensureAvailable(name, tagId);
                tag.rename(name, this.clock.now().toISOString());
                await this.tags.save(tag);

                return {
                    result: this.viewer.view(tag, await this.store.countByTag()),
                    before,
                    after: TagSnapshot.of(tag),
                };
            },
        );
    }
}
