import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import type { Filter } from './book-filter.util';
import { BookFilter } from './book-filter.util';
import { useFilterLabels } from './use-filter-labels';

// The advanced filters of a listing page (My books or Collections), read from its address.
export function useListingFilter(listing: 'books' | 'collections') {
    const { account } = useSession();
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

    return {
        filter,
        // Appended to the listing request.
        query: BookFilter.write(filter).toString(),
        change,
        // The filter page, which comes back to this listing with the same search and sorting.
        open: () => navigate('/' + listing + '/filters?' + parameters.toString()),
    };
}

// Removable chips for every applied filter value ("Owned ×", "Include: Fantasy ×").
export function AppliedFilters({
    filter,
    onChange,
}: {
    filter: Filter;
    onChange(filter: Filter): void;
}) {
    const { t } = useI18n();
    const label = useFilterLabels(filter);
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
                <Button variant="ghost" onClick={() => onChange(BookFilter.empty())}>
                    {t('filters.clear')}
                </Button>
            </li>
        </ul>
    );
}
