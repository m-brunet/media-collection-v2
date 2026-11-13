import type { BookDraftValues, SaveOptions } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';
import type { BookDto } from '../../../../../packages/contracts/src/http';
import { CategoryMismatch } from '../../shared/book-form/category-mismatch.util';
import {
    CategoryMismatchDialog,
    CoverageConflictDialog,
    PossibleDuplicateDialog,
    SimilarAuthorDialog,
    SimilarCollectionDialog,
    VolumeZeroDialog,
} from './book-form-dialogs';
import type { SaveQuestion } from '../../shared/book-form/use-book-save';
import { Required } from '../../shared/required.util';

export function BookSaveQuestions({
    question,
    book,
    values,
    creating,
    onChange,
    onSave,
    onChangeCollection,
    onOpenBook,
    onClose,
}: {
    question: SaveQuestion | null;
    book: BookDto | null;
    values: BookDraftValues;
    creating: boolean;
    onChange(draft: BookDraftValues): void;
    onSave(draft: BookDraftValues, answers?: SaveOptions, target?: string): void;
    onChangeCollection(collectionId: string, draft: BookDraftValues): void;
    onOpenBook(bookId: string): void;
    onClose(): void;
}) {
    const similarAuthor = question?.kind === 'similar-author' ? question.details : null;
    const duplicate = question?.kind === 'possible-duplicate' ? question.details : null;
    const similarCollection = question?.kind === 'similar-collection' ? question.details : null;
    const volumeZero = question?.kind === 'volume-zero' ? question.details : null;
    const coverage = question?.kind === 'coverage-conflict' ? question.details : null;
    const mismatch = question?.kind === 'category-mismatch' ? question.details : null;
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
                    saveChanged(
                        BookDraft.resolveAuthor(
                            values,
                            Required.value(similarAuthor, 'a similar author is being answered')
                                .name,
                            author,
                        ),
                    )
                }
                onCreate={() =>
                    saveChanged(
                        BookDraft.resolveAuthor(
                            values,
                            Required.value(similarAuthor, 'a similar author is being answered')
                                .name,
                            'distinct',
                        ),
                    )
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
            <CategoryMismatchDialog
                mismatch={mismatch}
                wholeCollection={
                    mismatch !== null &&
                    CategoryMismatch.changesWholeCollection(book, values, mismatch)
                }
                onClose={onClose}
                onUseCategory={() =>
                    saveChanged(
                        BookDraft.changed(values, {
                            category: Required.value(mismatch, 'a mismatch is being answered')
                                .category,
                        }),
                    )
                }
                onChangeCollection={() =>
                    onChangeCollection(
                        Required.value(mismatch, 'a mismatch is being answered').collectionId,
                        values,
                    )
                }
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
