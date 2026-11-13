import type { CollectionCategory } from '../../../domain/entities/collection.entity.js';
import type { RelatedChange } from '../../../../shared/application/ports/driven/audit-entry.interface.js';

export interface MemberCategories {
    change(category: CollectionCategory, bookIds: readonly string[]): Promise<RelatedChange[]>;
}
