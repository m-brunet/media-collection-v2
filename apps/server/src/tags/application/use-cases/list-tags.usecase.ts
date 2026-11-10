import type { ListTagsUseCase } from '../ports/driving/list-tags-use-case.interface.js';
import type { TagView } from '../tag-views.js';
import type { BookTagStore } from '../ports/driven/book-tag-store.interface.js';
import type { TagRepository } from '../ports/driven/tag-repository.interface.js';
import { TagViewer } from '../services/tag-viewer.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export class ListTags implements ListTagsUseCase {
    constructor(
        private readonly tags: TagRepository,
        private readonly store: BookTagStore,
        private readonly viewer: TagViewer,
    ) {}

    async execute(actor: Actor, search: string): Promise<TagView[]> {
        ActorAuthorization.requireReady(actor);
        const key = NameKey.of(search);
        const counts = await this.store.countByTag();

        return (await this.tags.list())
            .filter((tag) => tag.key.includes(key))
            .map((tag) => this.viewer.view(tag, counts));
    }
}
