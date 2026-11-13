import type { CategoryMismatchView } from '../../collection-views.js';

export interface CategoryMismatchReader {
    list(collectionId: string | null): Promise<CategoryMismatchView[]>;
}
