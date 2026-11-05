import type { ListCollectionsUseCase } from '../ports/driving/list-collections-use-case.interface.js';
import type { CollectionListPage, CollectionListQuery } from '../collection-views.js';
import type { CollectionBookSearch } from '../ports/driven/collection-book-search.interface.js';
import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import { CollectionViewer } from '../services/collection-viewer.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ListCollections implements ListCollectionsUseCase {
    constructor(
        private readonly collections: CollectionRepository,
        private readonly members: CollectionMemberStore,
        private readonly search: CollectionBookSearch,
        private readonly viewer: CollectionViewer,
    ) {}

    async execute(actor: Actor, query: CollectionListQuery): Promise<CollectionListPage> {
        ActorAuthorization.requireReady(actor);
        const readerId = query.filter.readerFor(actor);
        const ids =
            query.search.trim() || !query.filter.isEmpty()
                ? await this.search.collectionsMatching(query.search, query.filter, readerId)
                : null;
        const page = await this.collections.page({
            ids,
            direction: query.direction,
            offset: query.offset,
            limit: query.limit,
        });
        const records = await this.members.ofCollections(
            page.collections.map((collection) => collection.id),
        );

        return {
            total: page.total,
            items: page.collections.map((collection) =>
                this.viewer.summary(
                    collection,
                    records.filter((record) => record.collectionId === collection.id),
                ),
            ),
        };
    }
}
