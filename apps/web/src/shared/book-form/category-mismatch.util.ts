import type { BookDto, CategoryMismatchDetails } from '../../../../../packages/contracts/src/http';
import type { BookDraftValues } from './book-draft.util';

export class CategoryMismatch {
    static changesWholeCollection(
        book: BookDto | null,
        draft: BookDraftValues,
        details: CategoryMismatchDetails,
    ): boolean {
        return (
            book !== null &&
            book.collection?.id === details.collectionId &&
            book.category !== draft.category
        );
    }
}
