import type { ReactNode } from 'react';
import { useState } from 'react';
import type { BookBatchDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/notice';
import { Required } from '../../shared/required.util';
import { SimilarAuthorDialog } from '../books/book-form-dialogs';
import { BatchChanges } from './batch-changes';
import { BatchDrawer } from './batch-drawer';
import { BatchReview } from './batch-review';
import type { BatchDraft } from './book-batch.util';
import { BookBatch } from './book-batch.util';
import type { CoverTile } from './cover-tile';
import { useBatchEdit } from './use-batch-edit';

export type BatchStep = 'choose' | 'change' | 'review' | 'saved';

export interface BatchBook {
    id: string;
    owned: boolean;
}

export interface BatchBooksView {
    step: BatchStep;
    eyebrow: string;
    hint?: string;
    tile(id: string): CoverTile;
    onClick?(id: string): void;
}

function SelectionBar({
    chosen,
    total,
    onSelect,
    owned,
    all,
    onCancel,
    onEdit,
}: {
    chosen: number;
    total: number;
    owned: string[];
    all: string[];
    onSelect(ids: string[]): void;
    onCancel(): void;
    onEdit(): void;
}) {
    const { t } = useI18n();

    return (
        <div className="batch-bar">
            <strong className="batch-bar__count">
                {t(chosen <= 1 ? 'batch.chosenOne' : 'batch.chosenMany', {
                    count: chosen,
                    total,
                })}
            </strong>
            <Button onClick={() => onSelect(all)}>{t('batch.selectAll')}</Button>
            <Button onClick={() => onSelect(owned)}>{t('batch.selectOwned')}</Button>
            <Button variant="ghost" onClick={() => onSelect([])}>
                {t('batch.selectNone')}
            </Button>
            <span className="batch-bar__spacer" />
            <Button variant="ghost" onClick={onCancel}>
                {t('common.cancel')}
            </Button>
            <Button variant="primary" disabled={chosen === 0} onClick={onEdit}>
                {chosen === 1 ? t('batch.editOne') : t('batch.editMany', { count: chosen })}
            </Button>
        </div>
    );
}

function SavedNotice({
    result,
    onAgain,
    onDone,
}: {
    result: BookBatchDto;
    onAgain(): void;
    onDone(): void;
}) {
    const { t } = useI18n();
    const changed = BookBatch.changed(result);
    const message = [
        changed === 1 ? t('batch.savedOne') : t('batch.savedMany', { count: changed }),
        ...result.skipped.map((skip) =>
            t('batch.savedLeftOut', {
                title: skip.title,
                reason: t(BookBatch.skipReason(skip.reason)),
            }),
        ),
    ].join(' ');

    return (
        <Notice tone="success">
            <div className="batch-saved">
                <p>{message}</p>
                <div className="actions">
                    <Button onClick={onAgain}>{t('batch.again')}</Button>
                    <Button variant="primary" onClick={onDone}>
                        {t('batch.done')}
                    </Button>
                </div>
            </div>
        </Notice>
    );
}

export function BatchEditor({
    collectionId,
    books,
    limit = Number.POSITIVE_INFINITY,
    savedHint,
    renderBooks,
    onSaved,
    onExit,
}: {
    collectionId?: string;
    books: BatchBook[];
    limit?: number;
    savedHint: string;
    renderBooks(view: BatchBooksView): ReactNode;
    onSaved(): void;
    onExit(): void;
}) {
    const { t, locale } = useI18n();
    const [step, setStep] = useState<BatchStep>('choose');
    const [selected, setSelected] = useState<string[]>([]);
    const [capped, setCapped] = useState(false);
    const [draft, setDraft] = useState<BatchDraft>(BookBatch.draft());
    const [summary, setSummary] = useState<BookBatchDto | null>(null);
    const [result, setResult] = useState<BookBatchDto | null>(null);
    const [focus, setFocus] = useState<string | null>(null);
    const batch = useBatchEdit({
        collectionId,
        onPlanned: (planned) => {
            setSummary(planned);
            setFocus(null);
            setStep('review');
        },
        onSaved: (saved) => {
            setResult(saved);
            setSummary(null);
            setStep('saved');
            onSaved();
        },
    });
    const chosen = selected.filter((id) => books.some((book) => book.id === id));
    const editTitle =
        chosen.length === 1 ? t('batch.editOne') : t('batch.editMany', { count: chosen.length });
    const select = (ids: string[]) => {
        setCapped(ids.length > limit);
        setSelected(ids.slice(0, limit));
    };
    const toggle = (id: string) => {
        if (chosen.includes(id)) {
            setCapped(false);
            setSelected(chosen.filter((known) => known !== id));
        } else if (chosen.length >= limit) {
            setCapped(true);
        } else {
            setSelected([...chosen, id]);
        }
    };
    const leaveDrawer = (next: 'choose' | 'change') => {
        batch.clearFeedback();
        setSummary(null);
        setFocus(null);
        setStep(next);
    };
    const answerSimilar = (choice: { id: string; name: string } | 'distinct') => {
        const next = BookBatch.resolveAuthor(
            draft,
            Required.value(batch.similar, 'a similar author is being answered').name,
            choice,
        );

        batch.dismissSimilar();
        setDraft(next);
        batch.send(chosen, next, true);
    };
    const restart = () => {
        setDraft(BookBatch.draft());
        setResult(null);
        setStep('choose');
    };
    const drawer = step === 'change' || step === 'review';
    const view = (): BatchBooksView | null => {
        if (step === 'saved') {
            return result ? savedView(result) : null;
        }

        if (step === 'review') {
            return summary ? reviewView(summary) : null;
        }

        return {
            step,
            eyebrow:
                step === 'change'
                    ? chosen.length === 1
                        ? t('batch.wallChosenOne')
                        : t('batch.wallChosenMany', { count: chosen.length })
                    : t('batch.selectTitle'),
            hint: t(step === 'change' ? 'batch.wallChosenHint' : 'batch.chooseHint'),
            tile: (id) => ({
                chosen: chosen.includes(id),
                pressed: chosen.includes(id),
                check: true,
            }),
            onClick: toggle,
        };
    };
    const reviewView = (planned: BookBatchDto): BatchBooksView => {
        const outcomes = BookBatch.outcomes(planned, locale);
        const changed = BookBatch.changed(planned);

        return {
            step: 'review',
            eyebrow: [
                changed === 1
                    ? t('batch.wallChangeOne')
                    : t('batch.wallChangeMany', { count: changed }),
                planned.skipped.length > 0
                    ? t('batch.wallLeftOut', { count: planned.skipped.length })
                    : null,
            ]
                .filter(Boolean)
                .join(' · '),
            hint: t('batch.wallReviewHint'),
            tile: (id): CoverTile => {
                const outcome = outcomes.get(id);

                if (!chosen.includes(id) || !outcome) {
                    return { chosen: false, disabled: true, sub: t('batch.badge.notChosen') };
                }

                const pressed = focus === id;

                if (outcome === 'left-out') {
                    return {
                        chosen: false,
                        pressed,
                        dimmed: true,
                        badge: { label: t('batch.badge.leftOut'), tone: 'muted' },
                    };
                }

                return {
                    chosen: outcome.changes > 0,
                    pressed,
                    badge:
                        outcome.changes === 0
                            ? { label: t('batch.badge.noChange'), tone: 'muted' }
                            : {
                                  label:
                                      outcome.changes === 1
                                          ? t('batch.changesOne')
                                          : t('batch.changesMany', { count: outcome.changes }),
                                  tone: 'accent',
                              },
                };
            },
            onClick: (id) => setFocus(focus === id ? null : id),
        };
    };
    const savedView = (saved: BookBatchDto): BatchBooksView => {
        const updated = new Set(
            saved.books.filter((book) => Object.keys(book.after).length > 0).map((book) => book.id),
        );
        const leftOut = new Set(saved.skipped.map((skip) => skip.id));

        return {
            step: 'saved',
            eyebrow: t('batch.wallSaved'),
            hint: savedHint,
            tile: (id): CoverTile =>
                updated.has(id)
                    ? { chosen: false, badge: { label: t('batch.badge.updated'), tone: 'accent' } }
                    : leftOut.has(id)
                      ? {
                            chosen: false,
                            dimmed: true,
                            badge: { label: t('batch.badge.leftOut'), tone: 'muted' },
                        }
                      : { chosen: false },
        };
    };
    const shown = view();

    return (
        <div className={'batch-editor' + (drawer ? ' batch-editor--drawer' : '')}>
            {step === 'saved' && result && (
                <SavedNotice result={result} onAgain={restart} onDone={onExit} />
            )}
            {step === 'choose' && capped && <Notice tone="info">{t('batch.limit')}</Notice>}
            {shown && renderBooks(shown)}
            {step === 'choose' && (
                <SelectionBar
                    chosen={chosen.length}
                    total={books.length}
                    all={books.map((book) => book.id)}
                    owned={books.filter((book) => book.owned).map((book) => book.id)}
                    onSelect={select}
                    onCancel={onExit}
                    onEdit={() => setStep('change')}
                />
            )}
            {step === 'change' && (
                <BatchDrawer
                    step="change"
                    title={editTitle}
                    onClose={() => leaveDrawer('choose')}
                    footer={
                        <>
                            <Button onClick={() => leaveDrawer('choose')}>
                                {t('batch.backToSelection')}
                            </Button>
                            <span className="batch-drawer__count muted">
                                {draft.fields.length === 1
                                    ? t('batch.changesOne')
                                    : t('batch.changesMany', { count: draft.fields.length })}
                            </span>
                            <Button
                                variant="primary"
                                busy={batch.busy}
                                disabled={draft.fields.length === 0 || chosen.length === 0}
                                onClick={() => batch.send(chosen, draft, true)}
                            >
                                {t('batch.review')}
                            </Button>
                        </>
                    }
                >
                    <BatchChanges draft={draft} onChange={setDraft} />
                    {batch.feedback && <Notice tone="error">{batch.feedback.text}</Notice>}
                </BatchDrawer>
            )}
            {step === 'review' && summary && (
                <BatchDrawer
                    step="review"
                    title={t('batch.review')}
                    onClose={() => leaveDrawer('choose')}
                    footer={
                        <>
                            <Button onClick={() => leaveDrawer('change')}>{t('batch.back')}</Button>
                            <Button
                                variant="primary"
                                busy={batch.busy}
                                disabled={BookBatch.changed(summary) === 0}
                                onClick={() => batch.send(chosen, draft, false)}
                            >
                                {BookBatch.changed(summary) === 1
                                    ? t('batch.saveOne')
                                    : t('batch.saveMany', {
                                          count: BookBatch.changed(summary),
                                      })}
                            </Button>
                        </>
                    }
                >
                    <BatchReview
                        summary={summary}
                        draft={draft}
                        focus={focus}
                        onShowAll={() => setFocus(null)}
                    />
                    {batch.feedback && <Notice tone="error">{batch.feedback.text}</Notice>}
                </BatchDrawer>
            )}
            <SimilarAuthorDialog
                similar={batch.similar}
                onClose={batch.dismissSimilar}
                onUse={(author) => answerSimilar(author)}
                onCreate={() => answerSimilar('distinct')}
            />
        </div>
    );
}
