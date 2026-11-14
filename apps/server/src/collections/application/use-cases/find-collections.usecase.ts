import type { FindCollectionsUseCase } from '../ports/driving/find-collections-use-case.interface.js';
import type { CollectionNameView } from '../collection-views.js';
import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export class FindCollections implements FindCollectionsUseCase {
    private static readonly limit = 20;

    constructor(private readonly collections: CollectionRepository) {}

    async execute(search: string): Promise<CollectionNameView[]> {
        const key = NameKey.of(search);
        const found = (await this.collections.list()).filter((collection) =>
            collection.key.includes(key),
        );
        const exact = found.filter((collection) => collection.key === key);

        return [...exact, ...found.filter((collection) => collection.key !== key)]
            .slice(0, FindCollections.limit)
            .map((collection) => ({
                id: collection.id,
                name: collection.snapshot.name,
                category: collection.snapshot.category,
                includesVolumeZero: collection.snapshot.includesVolumeZero,
            }));
    }
}
