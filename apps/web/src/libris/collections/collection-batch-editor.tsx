import { useState } from 'react';
import type {
    BookBatchDto,
    CollectionDetailsDto,
    CollectionMemberDto,
} from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/notice';
import { SimilarAuthorDialog } from '../books/book-form-dialogs';
import { CollectionBatchChanges } from './collection-batch-changes';
import { CollectionBatchDrawer } from './collection-batch-drawer';
import { CollectionBatchReview } from './collection-batch-review';
import type { BatchDraft } from './collection-batch.util';
import { CollectionBatch } from './collection-batch.util';
import type { WallSlot } from './collection-covers.util';
import { CollectionCovers } from './collection-covers.util';
import type { WallTile } from './collection-wall';
import { CollectionWall } from './collection-wall';
import { useBatchEdit } from './use-batch-edit';
import { Required } from '../../shared/required.util';

type Step = 'choose' | 'change' | 'review' | 'saved';

function ReviewWall({
    slots,
    chosen,
    summary,
    focus,
    onFocus,
}: {
    slots: WallSlot[];
    chosen: string[];
    summary: BookBatchDto;
    focus: string | null;
    onFocus(id: string): void;
}) {
    const { t, locale } = useI18n();
    const outcomes = CollectionBatch.outcomes(summary, locale);
    const changed = CollectionBatch.changed(summary);
    const eyebrow = [
        changed === 1 ? t('batch.wallChangeOne') : t('batch.wallChangeMany', { count: changed }),
        summary.skipped.length > 0
            ? t('batch.wallLeftOut', { count: summary.skipped.length })
            : null,
    ]
        .filter(Boolean)
        .join(' · ');
    const tile = (book: CollectionMemberDto): WallTile => {
        const outcome = outcomes.get(book.id);

        if (!chosen.includes(book.id) || !outcome) {
            return { chosen: false, disabled: true, sub: t('batch.badge.notChosen') };
        }

        const pressed = focus === book.id;

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
    };

    return (
        <CollectionWall
            slots={slots}
            eyebrow={eyebrow}
            hint={t('batch.wallReviewHint')}
            tile={tile}
            onClick={(book) => onFocus(book.id)}
        />
    );
}

function SavedState({
    slots,
    result,
    onAgain,
    onDone,
}: {
    slots: WallSlot[];
    result: BookBatchDto;
    onAgain(): void;
    onDone(): void;
}) {
    const { t } = useI18n();
    const changed = CollectionBatch.changed(result);
    const updated = new Set(
        result.books.filter((book) => Object.keys(book.after).length > 0).map((book) => book.id),
    );
    const leftOut = new Set(result.skipped.map((skip) => skip.id));
    const message = [
        changed === 1 ? t('batch.savedOne') : t('batch.savedMany', { count: changed }),
        ...result.skipped.map((skip) =>
            t('batch.savedLeftOut', {
                title: skip.title,
                reason: t(CollectionBatch.skipReason(skip.reason)),
            }),
        ),
    ].join(' ');
    const tile = (book: CollectionMemberDto): WallTile =>
        updated.has(book.id)
            ? { chosen: false, badge: { label: t('batch.badge.updated'), tone: 'accent' } }
            : leftOut.has(book.id)
              ? {
                    chosen: false,
                    dimmed: true,
                    badge: { label: t('batch.badge.leftOut'), tone: 'muted' },
                }
              : { chosen: false };

    return (
        <>
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
            <CollectionWall
                slots={slots}
                eyebrow={t('batch.wallSaved')}
                hint={t('batch.wallSavedHint')}
                tile={tile}
            />
        </>
    );
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
    const [step, setStep] = useState<Step>('choose');
    const [selected, setSelected] = useState<string[]>([]);
    const [draft, setDraft] = useState<BatchDraft>(CollectionBatch.draft());
    const [summary, setSummary] = useState<BookBatchDto | null>(null);
    const [result, setResult] = useState<BookBatchDto | null>(null);
    const [focus, setFocus] = useState<string | null>(null);
    const batch = useBatchEdit({
        collectionId: collection.id,
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
    const books = CollectionCovers.books(collection);
    const slots = CollectionCovers.slots(collection);
    const chosen = selected.filter((id) => books.some((book) => book.id === id));
    const editTitle =
        chosen.length === 1 ? t('batch.editOne') : t('batch.editMany', { count: chosen.length });
    const leaveDrawer = (next: 'choose' | 'change') => {
        batch.clearFeedback();
        setSummary(null);
        setFocus(null);
        setStep(next);
    };
    const answerSimilar = (choice: { id: string; name: string } | 'distinct') => {
        const next = CollectionBatch.resolveAuthor(
            draft,
            Required.value(batch.similar, 'a similar author is being answered').name,
            choice,
        );

        batch.dismissSimilar();
        setDraft(next);
        batch.send(chosen, next, true);
    };
    const restart = () => {
        setDraft(CollectionBatch.draft());
        setResult(null);
        setStep('choose');
    };
    const drawer = step === 'change' || step === 'review';

    return (
        <div className={'batch-editor' + (drawer ? ' batch-editor--drawer' : '')}>
            {step === 'saved' && result && (
                <SavedState slots={slots} result={result} onAgain={restart} onDone={onExit} />
            )}
            {step === 'review' && summary && (
                <ReviewWall
                    slots={slots}
                    chosen={chosen}
                    summary={summary}
                    focus={focus}
                    onFocus={(id) => setFocus(focus === id ? null : id)}
                />
            )}
            {(step === 'choose' || step === 'change') && (
                <CollectionWall
                    slots={slots}
                    eyebrow={
                        step === 'change'
                            ? chosen.length === 1
                                ? t('batch.wallChosenOne')
                                : t('batch.wallChosenMany', { count: chosen.length })
                            : t('batch.selectTitle')
                    }
                    hint={t(step === 'change' ? 'batch.wallChosenHint' : 'batch.chooseHint')}
                    tile={(book) => ({
                        chosen: chosen.includes(book.id),
                        pressed: chosen.includes(book.id),
                        check: true,
                    })}
                    onClick={(book) =>
                        setSelected(
                            chosen.includes(book.id)
                                ? chosen.filter((id) => id !== book.id)
                                : [...chosen, book.id],
                        )
                    }
                />
            )}
            {step === 'choose' && (
                <SelectionBar
                    chosen={chosen.length}
                    total={books.length}
                    all={books.map((book) => book.id)}
                    owned={CollectionBatch.owned(collection)}
                    onSelect={setSelected}
                    onCancel={onExit}
                    onEdit={() => setStep('change')}
                />
            )}
            {step === 'change' && (
                <CollectionBatchDrawer
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
                    <CollectionBatchChanges draft={draft} onChange={setDraft} />
                    {batch.feedback && <Notice tone="error">{batch.feedback.text}</Notice>}
                </CollectionBatchDrawer>
            )}
            {step === 'review' && summary && (
                <CollectionBatchDrawer
                    step="review"
                    title={t('batch.review')}
                    onClose={() => leaveDrawer('choose')}
                    footer={
                        <>
                            <Button onClick={() => leaveDrawer('change')}>{t('batch.back')}</Button>
                            <Button
                                variant="primary"
                                busy={batch.busy}
                                disabled={CollectionBatch.changed(summary) === 0}
                                onClick={() => batch.send(chosen, draft, false)}
                            >
                                {CollectionBatch.changed(summary) === 1
                                    ? t('batch.saveOne')
                                    : t('batch.saveMany', {
                                          count: CollectionBatch.changed(summary),
                                      })}
                            </Button>
                        </>
                    }
                >
                    <CollectionBatchReview
                        summary={summary}
                        draft={draft}
                        focus={focus}
                        onShowAll={() => setFocus(null)}
                    />
                    {batch.feedback && <Notice tone="error">{batch.feedback.text}</Notice>}
                </CollectionBatchDrawer>
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
