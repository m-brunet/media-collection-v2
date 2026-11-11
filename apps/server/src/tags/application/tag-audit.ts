import type { Tag } from '../domain/entities/tag.entity.js';
import type { RelatedChange } from '../../shared/application/ports/driven/audit-entry.interface.js';

export const TagAudit = {
    tag: 'tag',
    created: 'tag.created',
    renamed: 'tag.renamed',
    deleted: 'tag.deleted',
} as const;

export class TagSnapshot {
    static of(tag: Tag): Record<string, unknown> {
        return { name: tag.snapshot.name };
    }

    static created(tag: Tag): RelatedChange {
        return {
            category: TagAudit.created,
            subjectType: TagAudit.tag,
            subjectId: tag.id,
            before: null,
            after: TagSnapshot.of(tag),
        };
    }
}
