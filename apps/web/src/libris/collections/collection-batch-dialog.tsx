import { useState } from 'react';
import type {
    BookBatchDto,
    BookBatchInputDto,
    SimilarAuthorDetails,
} from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { SelectField } from '../../shared/ui/select-field';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';
import { AuthorPicker } from '../books/author-picker';
import { SimilarAuthorDialog } from '../books/book-form-dialogs';
import { LocationField } from '../books/location-field';
import { TagPicker } from '../books/tag-picker';
import { useBookcases } from '../locations/use-bookcases';
import type { BatchDraft, BatchProblem, Shown, TextChoice } from './collection-batch.util';
import { CollectionBatch } from './collection-batch.util';

const problems: Record<BatchProblem, MessageKey> = {
    nothing: 'batch.problem.nothing',
    publisher: 'batch.problem.publisher',
    price: 'batch.problem.price',
    shelf: 'location.shelfRequired',
    authors: 'batch.problem.authors',
};

function TextChoiceField({
    label,
    choice,
    hint,
    onChange,
}: {
    label: string;
    choice: TextChoice;
    hint?: string;
    onChange(choice: TextChoice): void;
}) {
    const { t } = useI18n();

    return (
        <div className="batch-form__choice">
            <SelectField
                label={label}
                value={choice.mode}
                options={[
                    { value: 'keep', label: t('batch.keep') },
                    { value: 'set', label: t('batch.set') },
                    { value: 'fill', label: t('batch.fill') },
                    { value: 'clear', label: t('batch.clear') },
                ]}
                onChange={(event) =>
                    onChange({ ...choice, mode: event.target.value as TextChoice['mode'] })
                }
            />
            {CollectionBatch.takesValue(choice.mode) && (
                <TextField
                    label={t('batch.newValue', { field: label })}
                    hint={hint}
                    value={choice.value}
                    onChange={(event) => onChange({ ...choice, value: event.target.value })}
                />
            )}
        </div>
    );
}

function BatchForm({ draft, onChange }: { draft: BatchDraft; onChange(draft: BatchDraft): void }) {
    const { t } = useI18n();
    const { bookcases } = useBookcases();
    const set = <K extends keyof BatchDraft>(key: K, value: BatchDraft[K]) =>
        onChange({ ...draft, [key]: value });

    return (
        <div className="form batch-form">
            <p className="muted">{t('batch.intro')}</p>
            <div className="book-form__row book-form__row--two">
                <SelectField
                    label={t('form.category')}
                    value={draft.category}
                    options={[
                        { value: 'keep', label: t('batch.keep') },
                        ...BookFormat.categories.map((category) => ({
                            value: category,
                            label: t(BookFormat.category(category)),
                        })),
                    ]}
                    onChange={(event) =>
                        set('category', event.target.value as BatchDraft['category'])
                    }
                />
                <SelectField
                    label={t('form.ownership')}
                    value={draft.ownership}
                    options={[
                        { value: 'keep', label: t('batch.keep') },
                        ...BookFormat.ownerships.map((ownership) => ({
                            value: ownership,
                            label: t(BookFormat.ownership(ownership)),
                        })),
                    ]}
                    onChange={(event) =>
                        set('ownership', event.target.value as BatchDraft['ownership'])
                    }
                />
            </div>
            <div className="book-form__row book-form__row--two">
                <TextChoiceField
                    label={t('form.publisher')}
                    choice={draft.publisher}
                    onChange={(choice) => set('publisher', choice)}
                />
                <TextChoiceField
                    label={t('form.price')}
                    hint={t('batch.priceHint')}
                    choice={draft.price}
                    onChange={(choice) => set('price', choice)}
                />
            </div>
            <div className="batch-form__choice">
                <SelectField
                    label={t('batch.location')}
                    value={draft.shelf.mode}
                    options={[
                        { value: 'keep', label: t('batch.keep') },
                        { value: 'set', label: t('batch.setShelf') },
                        { value: 'fill', label: t('batch.fillShelf') },
                        { value: 'clear', label: t('batch.clearShelf') },
                    ]}
                    onChange={(event) =>
                        set('shelf', {
                            ...draft.shelf,
                            mode: event.target.value as BatchDraft['shelf']['mode'],
                        })
                    }
                />
                {CollectionBatch.takesValue(draft.shelf.mode) && bookcases && (
                    <LocationField
                        bookcases={bookcases}
                        bookcaseId={draft.shelf.bookcaseId}
                        shelfId={draft.shelf.shelfId}
                        onChange={(location) => set('shelf', { ...draft.shelf, ...location })}
                    />
                )}
            </div>
            <TagPicker
                label={t('batch.addTags')}
                hint={t('batch.addTagsHint')}
                existingOnly
                tags={draft.addTags}
                onChange={(tags) => set('addTags', tags)}
            />
            <TagPicker
                label={t('batch.removeTags')}
                existingOnly
                tags={draft.removeTags}
                onChange={(tags) => set('removeTags', tags)}
            />
            <div className="batch-form__choice">
                <label className="checkbox">
                    <input
                        type="checkbox"
                        checked={draft.replaceAuthors}
                        onChange={(event) => set('replaceAuthors', event.target.checked)}
                    />
                    {t('batch.replaceAuthors')}
                </label>
                {draft.replaceAuthors && (
                    <AuthorPicker
                        authors={draft.authors}
                        onChange={(authors) => set('authors', authors)}
                    />
                )}
            </div>
            <div className="book-form__row book-form__row--two">
                <SelectField
                    label={t('form.reading')}
                    hint={t('details.readingHint')}
                    value={draft.read}
                    options={[
                        { value: 'keep', label: t('batch.keep') },
                        { value: 'read', label: t('status.read') },
                        { value: 'not-read', label: t('status.notRead') },
                    ]}
                    onChange={(event) => set('read', event.target.value as BatchDraft['read'])}
                />
                <SelectField
                    label={t('batch.titles')}
                    hint={t('batch.titlesHint')}
                    value={draft.generatedTitles ? 'generated' : 'keep'}
                    options={[
                        { value: 'keep', label: t('batch.keep') },
                        { value: 'generated', label: t('batch.useGenerated') },
                    ]}
                    onChange={(event) => set('generatedTitles', event.target.value === 'generated')}
                />
            </div>
        </div>
    );
}

function BatchSummary({ summary }: { summary: BookBatchDto }) {
    const { t, locale } = useI18n();
    const shown = (value: Shown) => ('key' in value ? t(value.key) : value.text);

    return (
        <div className="stack stack--compact batch-summary">
            <p>{t('batch.summaryIntro')}</p>
            <ul className="batch-summary__books" aria-label={t('batch.changesLabel')}>
                {summary.books.map((book) => {
                    const lines = CollectionBatch.lines(book.before, book.after, locale);

                    return (
                        <li key={book.id} className="batch-summary__book">
                            <span className="batch-summary__title">{book.title}</span>
                            {lines.length === 0 ? (
                                <span className="muted">{t('batch.noChange')}</span>
                            ) : (
                                <ul className="batch-summary__lines">
                                    {lines.map((line) => (
                                        <li key={line.label}>
                                            {t(line.label)}: {shown(line.before)} →{' '}
                                            {shown(line.after)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
            {summary.skipped.length > 0 && (
                <>
                    <p className="field__label">{t('batch.skippedTitle')}</p>
                    <ul className="batch-summary__books" aria-label={t('batch.skippedTitle')}>
                        {summary.skipped.map((skip) => (
                            <li key={skip.id} className="batch-summary__book">
                                <span className="batch-summary__title">{skip.title}</span>
                                <span className="muted">
                                    {t(CollectionBatch.skipReason(skip.reason))}
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

export function CollectionBatchDialog({
    collectionId,
    bookIds,
    onClose,
    onSaved,
}: {
    collectionId: string;
    bookIds: string[];
    onClose(): void;
    onSaved(result: BookBatchDto): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const [draft, setDraft] = useState<BatchDraft>(CollectionBatch.draft());
    const [summary, setSummary] = useState<BookBatchDto | null>(null);
    const [similar, setSimilar] = useState<SimilarAuthorDetails | null>(null);
    const send = (next: BatchDraft, preview: boolean) => {
        const problem = CollectionBatch.problem(next);

        if (problem) {
            action.fail(problems[problem]);

            return;
        }

        const body: BookBatchInputDto = {
            collectionId,
            bookIds,
            preview,
            changes: CollectionBatch.changes(next),
        };

        void action.run(async () => {
            try {
                const result = await api.request<BookBatchDto>('/books/batch-edit', {
                    method: 'POST',
                    body,
                });

                if (preview) {
                    setSummary(result);
                } else {
                    onSaved(result);
                }
            } catch (error) {
                if (error instanceof ApiError && error.reason === 'author-similar') {
                    setSummary(null);
                    setSimilar(error.details as unknown as SimilarAuthorDetails);

                    return;
                }

                throw error;
            }
        });
    };
    const answerSimilar = (choice: { id: string; name: string } | 'distinct') => {
        const next = CollectionBatch.resolveAuthor(draft, similar!.name, choice);

        setSimilar(null);
        setDraft(next);
        send(next, true);
    };
    const changed = summary?.books.some((book) => Object.keys(book.after).length > 0) ?? false;

    return (
        <>
            <Dialog
                open={similar === null}
                title={t('batch.title', { count: bookIds.length })}
                onClose={onClose}
                footer={
                    summary ? (
                        <>
                            <Button onClick={() => setSummary(null)}>{t('batch.back')}</Button>
                            <Button
                                variant="primary"
                                busy={action.busy}
                                disabled={!changed}
                                onClick={() => send(draft, false)}
                            >
                                {t('batch.save')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={onClose}>{t('common.cancel')}</Button>
                            <Button
                                variant="primary"
                                busy={action.busy}
                                onClick={() => send(draft, true)}
                            >
                                {t('batch.review')}
                            </Button>
                        </>
                    )
                }
            >
                {summary ? (
                    <BatchSummary summary={summary} />
                ) : (
                    <BatchForm draft={draft} onChange={setDraft} />
                )}
                {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            </Dialog>
            <SimilarAuthorDialog
                similar={similar}
                onClose={() => setSimilar(null)}
                onUse={(author) => answerSimilar(author)}
                onCreate={() => answerSimilar('distinct')}
            />
        </>
    );
}
