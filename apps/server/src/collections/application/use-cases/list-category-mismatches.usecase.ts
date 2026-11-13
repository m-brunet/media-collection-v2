import type { ListCategoryMismatchesUseCase } from '../ports/driving/list-category-mismatches-use-case.interface.js';
import type { CategoryMismatchView } from '../collection-views.js';
import type { CategoryMismatchReader } from '../ports/driven/category-mismatch-reader.interface.js';
import type { CollectionLoader } from '../services/collection-loader.service.js';

export class ListCategoryMismatches implements ListCategoryMismatchesUseCase {
    constructor(
        private readonly mismatches: CategoryMismatchReader,
        private readonly loader: CollectionLoader,
    ) {}

    async execute(collectionId: string | null): Promise<CategoryMismatchView[]> {
        if (collectionId !== null) {
            await this.loader.load(collectionId);
        }

        return this.mismatches.list(collectionId);
    }
}
