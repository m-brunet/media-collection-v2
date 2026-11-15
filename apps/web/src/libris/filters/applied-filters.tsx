import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import type { Filter, FilterEntry } from './book-filter.util';
import { BookFilter } from './book-filter.util';
import { useFilterLabels } from './use-filter-labels';

const kinds: Partial<Record<FilterEntry['key'], MessageKey>> = {
    tag: 'filters.kind.tag',
    notTag: 'filters.kind.tag',
    author: 'filters.kind.author',
    collection: 'filters.kind.collection',
};

function kindOf(entry: FilterEntry): MessageKey {
    if (entry.key === 'location') {
        return entry.value.startsWith('bookcase:') ? 'filters.kind.bookcase' : 'filters.kind.shelf';
    }

    return kinds[entry.key] ?? 'filters.kind.tag';
}

export function useListingFilter(listing: 'books' | 'collections') {
    const { t } = useI18n();
    const { account } = useSession();
    const [removed, setRemoved] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const [parameters, setParameters] = useSearchParams();
    const filter = BookFilter.applicable(BookFilter.read(parameters), {
        guest: account?.role === 'guest',
        collections: listing === 'collections',
    });
    const change = useCallback(
        (next: Filter) =>
            setParameters(BookFilter.write(next, parameters), {
                replace: true,
                state: location.state,
            }),
        [parameters, setParameters, location.state],
    );
    const dropUnavailable = useCallback(
        (entries: readonly FilterEntry[]) => {
            change(
                entries.reduce(
                    (current, entry) => BookFilter.remove(current, entry.key, entry.value),
                    filter,
                ),
            );
            setRemoved(
                t(entries.length === 1 ? 'filters.unavailableOne' : 'filters.unavailableMany', {
                    kinds: [...new Set(entries.map(kindOf))].map((kind) => t(kind)).join(', '),
                }),
            );
        },
        [change, filter, t],
    );

    return {
        filter,
        query: BookFilter.write(filter).toString(),
        change,
        removed,
        closeRemoved: () => setRemoved(null),
        dropUnavailable,
        open: () => navigate('/' + listing + '/filters?' + parameters.toString()),
    };
}

export function AppliedFilters({
    filter,
    onChange,
    onClear,
    onUnavailable,
}: {
    filter: Filter;
    onChange(filter: Filter): void;
    onClear?(): void;
    onUnavailable?(entries: readonly FilterEntry[]): void;
}) {
    const { t } = useI18n();
    const { label, unavailable } = useFilterLabels(filter);
    const missing = unavailable.map((entry) => entry.key + ':' + entry.value).join('|');
    const reported = useRef('');

    useEffect(() => {
        if (missing && missing !== reported.current && onUnavailable) {
            reported.current = missing;
            onUnavailable(unavailable);
        }
    }, [missing, onUnavailable, unavailable]);
    const entries = BookFilter.entries(filter);

    if (entries.length === 0) {
        return null;
    }

    return (
        <ul className="applied-filters" aria-label={t('filters.applied')}>
            {entries.map((entry) => {
                const text = label(entry);

                return (
                    <li key={entry.key + ':' + entry.value}>
                        <button
                            type="button"
                            className="applied-filter"
                            aria-label={t('filters.removeNamed', { name: text })}
                            onClick={() =>
                                onChange(BookFilter.remove(filter, entry.key, entry.value))
                            }
                        >
                            <span>{text}</span>
                            <Icon name="close" size={14} />
                        </button>
                    </li>
                );
            })}
            <li>
                <Button
                    variant="ghost"
                    onClick={() => (onClear ? onClear() : onChange(BookFilter.empty()))}
                >
                    {t('filters.clear')}
                </Button>
            </li>
        </ul>
    );
}
