import type { CollectionMemberStore } from '../ports/driven/collection-member-store.interface.js';
import type { CollectionLoader } from './collection-loader.service.js';
import type { CollectionOwnedBooks } from '../../../books/application/ports/driven/collection-owned-books.interface.js';

export class OwnedCollectionBooks implements CollectionOwnedBooks {
    constructor(
        private readonly loader: CollectionLoader,
        private readonly members: CollectionMemberStore,
    ) {}

    async of(collectionId: string): Promise<string[]> {
        await this.loader.load(collectionId);
        const records = await this.members.ofCollections([collectionId]);

        return records
            .filter((record) => record.ownership === 'owned')
            .map((record) => record.bookId);
    }
}
