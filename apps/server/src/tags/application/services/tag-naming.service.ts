import type { TagRepository } from '../ports/driven/tag-repository.interface.js';
import { Tag } from '../../domain/entities/tag.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

// Tag names are unique: an equivalent name blocks a new tag or a rename, since merging tags is
// not available. (A book save reuses the equivalent tag instead.)
export class TagNaming {
    constructor(private readonly tags: TagRepository) {}

    async ensureAvailable(name: string, tagId: string | null): Promise<void> {
        const equivalent = await this.tags.findByKey(NameKey.of(Tag.validName(name)));

        if (equivalent && equivalent.id !== tagId) {
            throw new Failure('conflict', 'Another tag already has this name.', 'tag-name-taken');
        }
    }
}
