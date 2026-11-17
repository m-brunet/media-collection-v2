import type { CollectionDetailsDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { BatchEditor } from '../batch/batch-editor';
import { CollectionCovers } from './collection-covers.util';
import { CollectionWall } from './collection-wall';

export function CollectionBatchEditor({
    collection,
    onSaved,
    onExit,
}: {
    collection: CollectionDetailsDto;
    onSaved(): void;
    onExit(): void;
}) {
    const { t } = useI18n();
    const slots = CollectionCovers.slots(collection);
    const books = CollectionCovers.books(collection).map((book) => ({
        id: book.id,
        owned: book.ownership === 'owned',
    }));

    return (
        <BatchEditor
            collectionId={collection.id}
            books={books}
            savedHint={t('batch.wallSavedHint')}
            onSaved={onSaved}
            onExit={onExit}
            renderBooks={(view) => (
                <CollectionWall
                    slots={slots}
                    eyebrow={view.eyebrow}
                    hint={view.hint}
                    tile={(book) => view.tile(book.id)}
                    onClick={view.onClick && ((book) => view.onClick?.(book.id))}
                />
            )}
        />
    );
}
