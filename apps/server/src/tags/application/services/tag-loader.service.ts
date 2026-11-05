import type { TagRepository } from '../ports/driven/tag-repository.interface.js';
import type { Tag } from '../../domain/entities/tag.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class TagLoader {
    constructor(private readonly tags: TagRepository) {}

    async load(id: string): Promise<Tag> {
        const tag = await this.tags.findById(id);

        if (!tag) {
            throw new Failure('not_found', 'That tag does not exist.', 'tag-missing');
        }

        return tag;
    }
}
