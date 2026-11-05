import type { CollectionRepository } from '../ports/driven/collection-repository.interface.js';
import type { Collection } from '../../domain/entities/collection.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class CollectionLoader {
    constructor(private readonly collections: CollectionRepository) {}

    async load(id: string): Promise<Collection> {
        const collection = await this.collections.findById(id);

        if (!collection) {
            throw new Failure('not_found', 'That collection does not exist.', 'collection-missing');
        }

        return collection;
    }
}
