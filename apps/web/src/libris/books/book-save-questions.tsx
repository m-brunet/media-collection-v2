import type { BookDraftValues, SaveOptions } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';
import {
    CoverageConflictDialog,
    PossibleDuplicateDialog,
    SimilarAuthorDialog,
    SimilarCollectionDialog,
    VolumeZeroDialog,
} from './book-form-dialogs';
import type { SaveQuestion } from '../../shared/book-form/use-book-save';

export function BookSaveQuestions({
    question,
    values,
    creating,
    onChange,
    onSave,
    onOpenBook,
    onClose,
}: {
    question: SaveQuestion | null;
    values: BookDraftValues;
    creating: boolean;
    onChange(draft: BookDraftValues): void;
    onSave(draft: BookDraftValues, answers?: SaveOptions, target?: string): void;
    onOpenBook(bookId: string): void;
    onClose(): void;
}) {
    const similarAuthor = question?.kind === 'similar-author' ? question.details : null;
    const duplicate = question?.kind === 'possible-duplicate' ? question.details : null;
    const similarCollection = question?.kind === 'similar-collection' ? question.details : null;
    const volumeZero = question?.kind === 'volume-zero' ? question.details : null;
    const coverage = question?.kind === 'coverage-conflict' ? question.details : null;
    const saveChanged = (next: BookDraftValues) => {
        onClose();
        onChange(next);
        onSave(next);
    };

    return (
        <>
            <SimilarAuthorDialog
                similar={similarAuthor}
                onClose={onClose}
                onUse={(author) =>
                    saveChanged(BookDraft.resolveAuthor(values, similarAuthor!.name, author))
                }
                onCreate={() =>
                    saveChanged(BookDraft.resolveAuthor(values, similarAuthor!.name, 'distinct'))
                }
            />
            <PossibleDuplicateDialog
                duplicate={duplicate}
                onClose={onClose}
                onOpen={onOpenBook}
                onContinue={() => {
                    onClose();
                    onSave(values, { confirmDistinct: true });
                }}
            />
            <SimilarCollectionDialog
                similar={similarCollection}
                onClose={onClose}
                onUse={(name) =>
                    saveChanged({ ...values, collectionName: name, collectionDistinct: false })
                }
                onCreate={() => saveChanged({ ...values, collectionDistinct: true })}
            />
            <VolumeZeroDialog
                volumeZero={volumeZero}
                onClose={onClose}
                onEnable={() => saveChanged({ ...values, enableVolumeZero: true })}
            />
            <CoverageConflictDialog
                conflict={coverage}
                creating={creating}
                purchased={{
                    title: values.title,
                    isbn: values.noIsbn ? null : values.isbn.trim() || null,
                    volumeFrom: Number(values.volumeFrom),
                    volumeTo: Number(values.omnibus ? values.volumeTo : values.volumeFrom),
                }}
                onClose={onClose}
                onUpdatePlanned={(bookId) => {
                    onClose();
                    onSave({ ...values, ownership: 'owned' }, {}, bookId);
                }}
                onReplace={(bookIds) => {
                    onClose();
                    onSave(values, { replacePlanned: bookIds });
                }}
            />
        </>
    );
}
