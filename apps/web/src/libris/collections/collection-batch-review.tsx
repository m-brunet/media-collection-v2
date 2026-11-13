import { useId, useState } from 'react';
import type { BookBatchDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import type { BatchDraft, ChangeGroup, Shown } from './collection-batch.util';
import { CollectionBatch } from './collection-batch.util';
import { BatchChoice } from './collection-batch-choice';

type Grouping = 'change' | 'book';

function useShown() {
    const { t } = useI18n();

    return (value: Shown) => ('key' in value ? t(value.key) : value.text);
}

function BooksPill({ count, tone }: { count: number; tone?: 'warning' }) {
    const { t } = useI18n();

    return (
        <span className={'batch-pill' + (tone ? ' batch-pill--' + tone : '')}>
            {count === 1 ? t('batch.booksOne') : t('batch.booksMany', { count })}
        </span>
    );
}

function GroupCard({ group, draft }: { group: ChangeGroup; draft: BatchDraft }) {
    const { t } = useI18n();
    const shown = useShown();
    const field =
        t(group.label) +
        (CollectionBatch.fillsOnly(draft, group.label) ? ' · ' + t('batch.onlyWhereEmpty') : '');
    const titled = group.label !== 'form.title';
    const common = titled ? group.after : null;

    return (
        <li className="batch-change">
            <div className="batch-change__head">
                <span className="batch-change__field">{field}</span>
                <BooksPill count={group.books.length} />
            </div>
            {common && <p className="batch-change__value">→ {shown(common)}</p>}
            {common ? (
                <p className="batch-change__books">
                    {group.books
                        .map((book) => book.title + ' (' + shown(book.before) + ')')
                        .join(' · ')}
                </p>
            ) : (
                <ul className="batch-change__lines">
                    {group.books.map((book) => (
                        <li key={book.id}>
                            {titled && book.title + ': '}
                            {shown(book.before)} → {shown(book.after)}
                        </li>
                    ))}
                </ul>
            )}
            {group.others > 0 && (
                <p className="batch-change__books">
                    {group.others === 1
                        ? t('batch.othersOne')
                        : t('batch.othersMany', { count: group.others })}
                </p>
            )}
        </li>
    );
}

function LeftOut({ summary }: { summary: BookBatchDto }) {
    const { t } = useI18n();

    return (
        summary.skipped.length > 0 && (
            <ul className="batch-review__cards" aria-label={t('batch.skippedTitle')}>
                {summary.skipped.map((skip) => (
                    <li key={skip.id} className="batch-change batch-change--left-out">
                        <div className="batch-change__head">
                            <span className="batch-change__field">{t('batch.badge.leftOut')}</span>
                            <BooksPill count={1} tone="warning" />
                        </div>
                        <p className="batch-change__value">{skip.title}</p>
                        <p className="batch-change__books">
                            {t('batch.leftOutBody', {
                                reason: t(CollectionBatch.skipReason(skip.reason)),
                            })}
                        </p>
                    </li>
                ))}
            </ul>
        )
    );
}

function ByChange({ summary, draft }: { summary: BookBatchDto; draft: BatchDraft }) {
    const { t, locale } = useI18n();
    const groups = CollectionBatch.byChange(summary, locale);

    return (
        <>
            {groups.length === 0 ? (
                <p className="muted">{t('batch.noChange')}</p>
            ) : (
                <ul className="batch-review__cards" aria-label={t('batch.changesLabel')}>
                    {groups.map((group) => (
                        <GroupCard key={group.label} group={group} draft={draft} />
                    ))}
                </ul>
            )}
            <LeftOut summary={summary} />
        </>
    );
}

function ByBook({ summary }: { summary: BookBatchDto }) {
    const { t, locale } = useI18n();
    const shown = useShown();

    return (
        <>
            {summary.books.length > 0 && (
                <ul className="batch-review__cards" aria-label={t('batch.changesLabel')}>
                    {summary.books.map((book) => {
                        const lines = CollectionBatch.lines(book.before, book.after, locale);

                        return (
                            <li key={book.id} className="batch-change">
                                <span className="batch-change__value">{book.title}</span>
                                {lines.length === 0 ? (
                                    <span className="muted">{t('batch.noChange')}</span>
                                ) : (
                                    <ul className="batch-change__lines">
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
            )}
            <LeftOut summary={summary} />
        </>
    );
}

export function CollectionBatchReview({
    summary,
    draft,
    focus,
    onShowAll,
}: {
    summary: BookBatchDto;
    draft: BatchDraft;
    focus: string | null;
    onShowAll(): void;
}) {
    const { t } = useI18n();
    const groupId = useId();
    const [grouping, setGrouping] = useState<Grouping>('change');
    const focused = focus ? CollectionBatch.only(summary, focus) : summary;
    const focusTitle = [...focused.books, ...focused.skipped].find(
        (book) => book.id === focus,
    )?.title;

    return (
        <div className="batch-review">
            <p className="muted">{t('batch.summaryIntro')}</p>
            <div className="batch-review__grouping">
                <span id={groupId}>{t('batch.groupBy')}</span>
                <BatchChoice<Grouping>
                    labelledBy={groupId}
                    value={grouping}
                    choices={[
                        { value: 'change', label: t('batch.groupBy.change') },
                        { value: 'book', label: t('batch.groupBy.book') },
                    ]}
                    onChange={setGrouping}
                />
            </div>
            {focusTitle && (
                <div className="batch-review__focus">
                    <span>{t('batch.focus', { title: focusTitle })}</span>
                    <Button variant="ghost" onClick={onShowAll}>
                        {t('batch.showAll')}
                    </Button>
                </div>
            )}
            {grouping === 'change' ? (
                <ByChange summary={focused} draft={draft} />
            ) : (
                <ByBook summary={focused} />
            )}
        </div>
    );
}
