import type { BookDto, CollectionNameDto } from '../../../../../packages/contracts/src/http';
import type { BookDraftValues } from './book-draft.util';
import { BookDraft } from './book-draft.util';

export type CategoryRule =
    | { kind: 'free' }
    | { kind: 'locked'; collection: CollectionNameDto }
    | { kind: 'member'; name: string };

export class CategoryLock {
    static of(
        book: BookDto | null,
        values: BookDraftValues,
        names: readonly CollectionNameDto[],
    ): CategoryRule {
        const key = BookDraft.nameKey(values.collectionName);

        if (!values.inCollection || key === '') {
            return { kind: 'free' };
        }

        if (book?.collection && BookDraft.nameKey(book.collection.name) === key) {
            return { kind: 'member', name: book.collection.name };
        }

        const collection = names.find((candidate) => BookDraft.nameKey(candidate.name) === key);

        return collection ? { kind: 'locked', collection } : { kind: 'free' };
    }
}
