import { useEffect, useState } from 'react';
import type { TagDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';
import { Notice } from '../../shared/ui/notice';
import { BookDraft } from '../books/book-draft.util';
import type { Filter, TagChoice } from './book-filter.util';
import { BookFilter } from './book-filter.util';

// Summary chips shown before the rest are reviewed under "Selected".
const summaryLimit = 6;
const choices: Record<TagChoice, MessageKey> = {
    none: 'filters.tagChoice.none',
    include: 'filters.tagChoice.include',
    exclude: 'filters.tagChoice.exclude',
};

// Tag criteria: each tag is not selected, included or excluded. Every included tag must be on
// the book and any excluded tag rejects it, in one combined search.
export function TagFilter({
    filter,
    onChange,
}: {
    filter: Filter;
    onChange(filter: Filter): void;
}) {
    const { t } = useI18n();
    const [tags, setTags] = useState<TagDto[] | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectedOnly, setSelectedOnly] = useState(false);

    useEffect(() => {
        let current = true;

        api.request<TagDto[]>('/tags').then(
            (found) => current && setTags(found),
            (error: unknown) => current && setFailure(t(ApiErrorMessage.key(error))),
        );

        return () => {
            current = false;
        };
    }, [t]);

    const all = tags ?? [];
    const selected = all.filter((tag) => BookFilter.tagChoice(filter, tag.id) !== 'none');
    const key = BookDraft.nameKey(search);
    const listed = (selectedOnly ? selected : all).filter((tag) =>
        BookDraft.nameKey(tag.name).includes(key),
    );
    const chips = [
        ...filter.tag.map((id) => ({ id, choice: 'include' as const })),
        ...filter.notTag.map((id) => ({ id, choice: 'exclude' as const })),
    ];
    const name = (id: string) => all.find((tag) => tag.id === id)?.name ?? '…';

    return (
        <section className="tag-filter" aria-labelledby="tag-filter-title">
            <div className="tag-filter__header">
                <h3 id="tag-filter-title" className="eyebrow">
                    {t('filters.tags')}
                </h3>
                <button
                    type="button"
                    className="link-button"
                    disabled={chips.length === 0}
                    onClick={() => onChange(BookFilter.withoutTags(filter))}
                >
                    {t('filters.resetTags')}
                </button>
            </div>
            {failure && <Notice tone="error">{failure}</Notice>}
            <div className="search-field">
                <Icon name="search" className="search-field__icon" />
                <label htmlFor="tag-filter-search" className="visually-hidden">
                    {t('filters.findTag')}
                </label>
                <input
                    id="tag-filter-search"
                    type="search"
                    className="field__control search-field__control"
                    placeholder={t('filters.findTag') + '…'}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            </div>
            <div className="tag-filter__tabs" role="group" aria-label={t('filters.tagView')}>
                <button
                    type="button"
                    className="tag-filter__tab"
                    aria-pressed={!selectedOnly}
                    onClick={() => setSelectedOnly(false)}
                >
                    {t('filters.allTags', { count: all.length })}
                </button>
                <button
                    type="button"
                    className="tag-filter__tab"
                    aria-pressed={selectedOnly}
                    onClick={() => setSelectedOnly(true)}
                >
                    {t('filters.selectedTags', { count: selected.length })}
                </button>
            </div>
            {chips.length > 0 && (
                <ul className="applied-filters" aria-label={t('filters.tagSummary')}>
                    {chips.slice(0, summaryLimit).map((chip) => {
                        const text = t(
                            chip.choice === 'include' ? 'filters.include' : 'filters.exclude',
                            { name: name(chip.id) },
                        );

                        return (
                            <li key={chip.choice + chip.id}>
                                <button
                                    type="button"
                                    className={'applied-filter applied-filter--' + chip.choice}
                                    aria-label={t('filters.removeNamed', { name: text })}
                                    onClick={() =>
                                        onChange(BookFilter.withTag(filter, chip.id, 'none'))
                                    }
                                >
                                    <span>{text}</span>
                                    <Icon name="close" size={14} />
                                </button>
                            </li>
                        );
                    })}
                    {chips.length > summaryLimit && (
                        <li>
                            <button
                                type="button"
                                className="applied-filter"
                                onClick={() => setSelectedOnly(true)}
                            >
                                {t('filters.more', { count: chips.length - summaryLimit })}
                            </button>
                        </li>
                    )}
                </ul>
            )}
            {tags && all.length === 0 && <p className="muted">{t('filters.noTags')}</p>}
            {listed.length > 0 && (
                <ul className="tag-filter__list">
                    {listed.map((tag) => {
                        const current = BookFilter.tagChoice(filter, tag.id);

                        return (
                            <li key={tag.id} className="tag-filter__row">
                                <span id={'tag-choice-' + tag.id}>{tag.name}</span>
                                <div
                                    role="radiogroup"
                                    aria-labelledby={'tag-choice-' + tag.id}
                                    className="segmented"
                                >
                                    {(Object.keys(choices) as TagChoice[]).map((choice) => (
                                        <label
                                            key={choice}
                                            className={
                                                'segmented__option segmented__option--' + choice
                                            }
                                        >
                                            <input
                                                type="radio"
                                                name={'tag-' + tag.id}
                                                className="visually-hidden"
                                                checked={current === choice}
                                                onChange={() =>
                                                    onChange(
                                                        BookFilter.withTag(filter, tag.id, choice),
                                                    )
                                                }
                                            />
                                            {t(choices[choice])}
                                        </label>
                                    ))}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            {tags && all.length > 0 && (
                <p className="muted">
                    {t('filters.tagsShown', {
                        shown: listed.length,
                        total: selectedOnly ? selected.length : all.length,
                    })}
                </p>
            )}
        </section>
    );
}
