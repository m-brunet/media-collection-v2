import type { CreateTagUseCase } from '../ports/driving/create-tag-use-case.interface.js';
import { TagAudit, TagSnapshot } from '../tag-audit.js';
import type { TagView } from '../tag-views.js';
import type { TagRepository } from '../ports/driven/tag-repository.interface.js';
import { TagNaming } from '../services/tag-naming.service.js';
import { TagViewer } from '../services/tag-viewer.service.js';
import { Tag } from '../../domain/entities/tag.entity.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// A new unused tag, from the Tags page. An equivalent existing name is refused.
export class CreateTag implements CreateTagUseCase {
    constructor(
        private readonly tags: TagRepository,
        private readonly naming: TagNaming,
        private readonly viewer: TagViewer,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, name: string): Promise<TagView> {
        return this.operations.run(
            {
                category: TagAudit.created,
                actorId: actor.id,
                subjectType: TagAudit.tag,
                subjectId: null,
            },
            async (context) => {
                ActorAuthorization.requireLibraryEditor(actor);
                await this.naming.ensureAvailable(name, null);
                const now = this.clock.now().toISOString();
                const tag = new Tag({ id: this.ids.next(), name, createdAt: now, updatedAt: now });

                context.subjectId = tag.id;
                await this.tags.create(tag);

                return {
                    result: this.viewer.view(tag, new Map()),
                    before: null,
                    after: TagSnapshot.of(tag),
                };
            },
        );
    }
}
