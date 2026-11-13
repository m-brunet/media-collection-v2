import type { CategoryMismatchView } from '../../collection-views.js';

export interface ListCategoryMismatchesUseCase {
    execute(collectionId: string | null): Promise<CategoryMismatchView[]>;
}
