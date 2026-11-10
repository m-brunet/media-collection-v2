import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import type {
    CollectionListPageDto,
    CollectionSummaryDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { BookCover } from '../books/book-cover';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { CollectionFormat } from './collection-format.util';
import { AppliedFilters, useListingFilter } from '../filters/applied-filters';
import { BookFilter } from '../filters/book-filter.util';

const pageSize = 48;

interface Listing {
    query: string;
    total: number;
    items: CollectionSummaryDto[];
}

// The covers are decorative; the name and coverage name the link.
function CollectionCard({ collection }: { collection: CollectionSummaryDto }) {
    const { t } = useI18n();
    const message = CollectionFormat.status(collection);
    const status = t(message.key, message.values);
    const owned = t('collections.owned', {
        owned: collection.ownedCount,
        expected: collection.expectedCount,
    });

    return (
        <li>
            <Link
                to={'/collections/' + collection.id}
                className="collection-card"
                aria-label={[collection.name, owned, status].join(', ')}
            >
                <div className="collection-card__identity">
                    <span className="collection-card__name">{collection.name}</span>
                    <span className="collection-card__open">
                        {t('collections.open')} <span aria-hidden="true">→</span>
                    </span>
                </div>
                <div className="collection-card__coverage">
                    {collection.previews.length > 0 && (
                        <div className="collection-card__covers" aria-hidden="true">
                            {collection.previews.map((preview) => (
                                <BookCover
                                    key={preview.id}
                                    src={BookFormat.cover(preview.id, preview.updatedAt)}
                                    title={preview.title}
                                    size="small"
                                />
                            ))}
                        </div>
                    )}
                    <div className="collection-card__counts">
                        <span className="collection-card__owned">{owned}</span>
                        <span
                            className={
                                'collection-card__status' +
                                (collection.finished ? ' collection-card__status--finished' : '')
                            }
                        >
                            {status}
                        </span>
                    </div>
                </div>
            </Link>
        </li>
    );
}

// Counts always describe the whole collection, whatever book matched the search.
export function CollectionsPage() {
    const { t } = useI18n();
    const { account } = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const [parameters, setParameters] = useSearchParams();
    const search = parameters.get('search') ?? '';
    const direction = parameters.get('direction') === 'desc' ? 'desc' : 'asc';
    const [typed, setTyped] = useState(search);
    const [listing, setListing] = useState<Listing | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [failure, setFailure] = useState<{ query: string; text: string } | null>(null);
    const editor = account?.role !== 'guest';
    const deleted = (location.state as { deleted?: string } | null)?.deleted;
    const filters = useListingFilter('collections');
    const filtered = BookFilter.active(filters.filter);
    const [allTotal, setAllTotal] = useState<number | null>(null);
    const query =
        new URLSearchParams({ search, direction, limit: String(pageSize) }).toString() +
        (filtered ? '&' + filters.query : '');
    const fetchPage = useCallback(
        (offset: number) =>
            api.request<CollectionListPageDto>('/collections?' + query + '&offset=' + offset),
        [query],
    );
    const update = useCallback(
        (changes: Record<string, string>) => {
            const next = new URLSearchParams(parameters);

            for (const [key, value] of Object.entries(changes)) {
                if (value) {
                    next.set(key, value);
                } else {
                    next.delete(key);
                }
            }

            setParameters(next, { replace: true, state: location.state });
        },
        [parameters, setParameters, location.state],
    );

    useEffect(() => {
        if (typed === search) {
            return;
        }

        const timer = setTimeout(() => update({ search: typed.trim() ? typed : '' }), 250);

        return () => clearTimeout(timer);
    }, [typed, search, update]);

    useEffect(() => {
        let current = true;

        api.request<CollectionListPageDto>('/collections?limit=1').then(
            (page) => current && setAllTotal(page.total),
            () => undefined,
        );

        return () => {
            current = false;
        };
    }, []);

    useEffect(() => {
        let current = true;

        fetchPage(0).then(
            (page) => current && setListing({ query, ...page }),
            (error: unknown) =>
                current && setFailure({ query, text: t(ApiErrorMessage.key(error)) }),
        );

        return () => {
            current = false;
        };
    }, [fetchPage, query, t]);

    const loadMore = async () => {
        if (!listing) {
            return;
        }

        setLoadingMore(true);

        try {
            const page = await fetchPage(listing.items.length);

            setListing({ ...listing, total: page.total, items: [...listing.items, ...page.items] });
        } catch (failed) {
            setFailure({ query, text: t(ApiErrorMessage.key(failed)) });
        } finally {
            setLoadingMore(false);
        }
    };
    const current = listing?.query === query ? listing : null;
    const error = failure?.query === query ? failure.text : null;
    const narrowed = Boolean(search) || filtered;
    const none = current && current.total === 0 && !narrowed;
    const clearAll = () => {
        setTyped('');
        setParameters(BookFilter.write(BookFilter.empty(), new URLSearchParams()), {
            replace: true,
        });
    };

    return (
        <>
            <PageHeader title={t('collections.title')} intro={t('collections.intro')} />
            <div className="stack">
                {deleted && (
                    <Notice tone="success">{t('collections.deleted', { name: deleted })}</Notice>
                )}
                {!none && (
                    <div className="book-toolbar">
                        <div className="search-field">
                            <Icon name="search" className="search-field__icon" />
                            <label htmlFor="collection-search" className="visually-hidden">
                                {t('collections.searchLabel')}
                            </label>
                            <input
                                id="collection-search"
                                type="search"
                                className="field__control search-field__control"
                                placeholder={t('books.searchPlaceholder')}
                                value={typed}
                                onChange={(event) => setTyped(event.target.value)}
                            />
                        </div>
                        <Button icon="filter" onClick={filters.open}>
                            {t('filters.open')}
                        </Button>
                        <label htmlFor="collection-sort" className="visually-hidden">
                            {t('collections.sortLabel')}
                        </label>
                        <select
                            id="collection-sort"
                            className="field__control field__control--select book-toolbar__sort"
                            value={direction}
                            onChange={(event) =>
                                update({
                                    direction: event.target.value === 'desc' ? 'desc' : '',
                                })
                            }
                        >
                            {CollectionFormat.sorts.map((choice) => (
                                <option key={choice.direction} value={choice.direction}>
                                    {t(choice.label)}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {!none && (filtered || (current && search)) && (
                    <div className="applied-row">
                        <AppliedFilters filter={filters.filter} onChange={filters.change} />
                        {current && allTotal !== null && (
                            <p className="muted applied-row__count" role="status">
                                {t('collections.matching', {
                                    count: current.total,
                                    total: allTotal,
                                })}
                            </p>
                        )}
                    </div>
                )}
                {error && <Notice tone="error">{error}</Notice>}
                {!current && !error && <LoadingState label={t('collections.loading')} />}
                {none && (
                    <EmptyState
                        icon="collections"
                        title={editor ? t('collections.empty') : t('collections.emptyGuest')}
                        action={
                            editor && (
                                <Button variant="primary" onClick={() => navigate('/books/new')}>
                                    {t('books.add')}
                                </Button>
                            )
                        }
                    />
                )}
                {current && current.total === 0 && filtered && (
                    <EmptyState
                        icon="search"
                        title={t('collections.noMatching')}
                        body={
                            search
                                ? t('collections.noMatchingSearch', { search })
                                : t('collections.noMatchingFilters')
                        }
                        action={
                            <Button variant="primary" onClick={clearAll}>
                                {t('filters.clear')}
                            </Button>
                        }
                    />
                )}
                {current && current.total === 0 && search && !filtered && (
                    <EmptyState
                        icon="search"
                        title={t('collections.noResults', { search })}
                        body={t('collections.noResultsHint')}
                        action={
                            <Button
                                onClick={() => {
                                    setTyped('');
                                    update({ search: '' });
                                }}
                            >
                                {t('books.clearSearch')}
                            </Button>
                        }
                    />
                )}
                {current && current.items.length > 0 && (
                    <>
                        <ul className="collection-grid">
                            {current.items.map((collection) => (
                                <CollectionCard key={collection.id} collection={collection} />
                            ))}
                        </ul>
                        {current.items.length < current.total && (
                            <div className="book-grid__more">
                                <Button busy={loadingMore} onClick={() => void loadMore()}>
                                    {t('books.loadMore')}
                                </Button>
                                <span className="muted">
                                    {t('books.showing', {
                                        shown: current.items.length,
                                        total: current.total,
                                    })}
                                </span>
                            </div>
                        )}
                        <p className="muted">{t('collections.footnote')}</p>
                    </>
                )}
            </div>
        </>
    );
}
