import type { ReactNode } from 'react';
import type { BookDraftValues, SaveOptions } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';
import type { SaveQuestion } from '../../shared/book-form/use-book-save';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';

function Question({
    title,
    body,
    children,
    onClose,
}: {
    title: string;
    body: ReactNode;
    children: ReactNode;
    onClose(): void;
}) {
    const { t } = useI18n();

    return (
        <Dialog open title={title} onClose={onClose}>
            {body}
            <div className="leaf-question__answers">
                {children}
                <Button onClick={onClose}>{t('common.cancel')}</Button>
            </div>
        </Dialog>
    );
}

export function LeafSaveQuestions({
    question,
    values,
    onChange,
    onSave,
    onClose,
}: {
    question: SaveQuestion | null;
    values: BookDraftValues;
    onChange(draft: BookDraftValues): void;
    onSave(draft: BookDraftValues, answers?: SaveOptions, target?: string): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const saveChanged = (next: BookDraftValues) => {
        onClose();
        onChange(next);
        onSave(next);
    };

    switch (question?.kind) {
        case undefined:
            return null;
        case 'similar-author': {
            const { name, candidates } = question.details;

            return (
                <Question
                    title={t('similar.title')}
                    body={<p>{t('similar.body', { name })}</p>}
                    onClose={onClose}
                >
                    {candidates.map((candidate) => (
                        <Button
                            key={candidate.id}
                            variant="primary"
                            onClick={() =>
                                saveChanged(BookDraft.resolveAuthor(values, name, candidate))
                            }
                        >
                            {t('similar.use', { name: candidate.name })}
                        </Button>
                    ))}
                    <Button
                        onClick={() =>
                            saveChanged(BookDraft.resolveAuthor(values, name, 'distinct'))
                        }
                    >
                        {t('similar.create', { name })}
                    </Button>
                </Question>
            );
        }
        case 'similar-collection': {
            const { name, candidates } = question.details;

            return (
                <Question
                    title={t('similarCollection.title')}
                    body={<p>{t('similarCollection.body', { name })}</p>}
                    onClose={onClose}
                >
                    {candidates.map((candidate) => (
                        <Button
                            key={candidate.id}
                            variant="primary"
                            onClick={() =>
                                saveChanged({
                                    ...values,
                                    collectionName: candidate.name,
                                    collectionDistinct: false,
                                })
                            }
                        >
                            {t('similarCollection.use', { name: candidate.name })}
                        </Button>
                    ))}
                    <Button onClick={() => saveChanged({ ...values, collectionDistinct: true })}>
                        {t('similarCollection.create', { name })}
                    </Button>
                </Question>
            );
        }
        case 'volume-zero':
            return (
                <Question
                    title={t('volumeZero.title')}
                    body={<p>{t('volumeZero.body', { name: question.details.name })}</p>}
                    onClose={onClose}
                >
                    <Button
                        variant="primary"
                        onClick={() => saveChanged({ ...values, enableVolumeZero: true })}
                    >
                        {t('volumeZero.confirm')}
                    </Button>
                </Question>
            );
        case 'possible-duplicate':
            return (
                <Question
                    title={t('duplicate.title')}
                    body={<p>{t('duplicate.body')}</p>}
                    onClose={onClose}
                >
                    <Button
                        variant="primary"
                        onClick={() => {
                            onClose();
                            onSave(values, { confirmDistinct: true });
                        }}
                    >
                        {t('duplicate.continue')}
                    </Button>
                </Question>
            );
        case 'coverage-conflict': {
            const { conflicts, replaceable } = question.details;
            const list = (
                <ul className="leaf-question__books">
                    {conflicts.map((book) => (
                        <li key={book.id}>{book.title}</li>
                    ))}
                </ul>
            );

            if (!replaceable) {
                return (
                    <Question
                        title={t('coverage.blockedTitle')}
                        body={
                            <>
                                <p>{t('coverage.blockedBody')}</p>
                                {list}
                            </>
                        }
                        onClose={onClose}
                    >
                        {null}
                    </Question>
                );
            }

            const single = conflicts.length === 1;

            return (
                <Question
                    title={single ? t('coverage.title') : t('coverage.manyTitle')}
                    body={
                        <>
                            <p>{t('coverage.body')}</p>
                            {list}
                        </>
                    }
                    onClose={onClose}
                >
                    {single && (
                        <Button
                            variant="primary"
                            onClick={() => {
                                onClose();
                                onSave({ ...values, ownership: 'owned' }, {}, conflicts[0]!.id);
                            }}
                        >
                            {t('coverage.update')}
                        </Button>
                    )}
                    <Button
                        onClick={() => {
                            onClose();
                            onSave(values, {
                                replacePlanned: conflicts.map((book) => book.id),
                            });
                        }}
                    >
                        {single ? t('coverage.delete') : t('coverage.deleteMany')}
                    </Button>
                </Question>
            );
        }
    }
}
