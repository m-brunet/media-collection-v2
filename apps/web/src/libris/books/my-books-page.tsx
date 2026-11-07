import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import type { BookListItemDto, BookListPageDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { BookCover } from './book-cover';
import { CollectionFormat } from '../collections/collection-format.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { AppliedFilters, useListingFilter } from '../filters/applied-filters';
import { BookFilter } from '../filters/book-filter.util';

const pageSize = 48;

interface Listing {
    query: string;
    total: number;
    items: BookListItemDto[];
}

function BookCard({ book }: { book: BookListItemDto }) {
    const { t } = useI18n();
    const status = [t(BookFormat.ownership(book.ownership))];

    if (book.read !== null) {
        status.push(t(BookFormat.reading(book.read)));
    }

    if (book.loan) {
        status.push(t('books.lent'));
    }

    const volumes = book.collection
        ? CollectionFormat.volumes(book.collection.volumeFrom, book.collection.volumeTo)
        : null;

    return (
        <li>
            <Link to={'/books/' + book.id} className="book-card">
                <BookCover
                    src={book.hasCover ? BookFormat.cover(book.id, book.updatedAt) : null}
                    title={book.title}
                />
                <span className="book-card__title">{book.title}</span>
                <span className="book-card__authors">{book.authors.join(', ')}</span>
                {book.collection && volumes && (
                    <span className="book-card__collection">
                        {t('books.collection', {
                            name: book.collection.name,
                            volumes: t(volumes.key, volumes.values),
                        })}
                    </span>
                )}
                <span className="book-card__status">{status.join(' · ')}</span>
            </Link>
        </li>
    );
}

// The shared library as a cover grid, with simple search, sorting and paging.
export function MyBooksPage() {
    const { t } = useI18n();
    const { account } = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const [parameters, setParameters] = useSearchParams();
    const search = parameters.get('search') ?? '';
    const sortIndex = Math.max(
        0,
        BookFormat.sorts.findIndex(
            (choice) => choice.sort + '-' + choice.direction === parameters.get('sort'),
        ),
    );
    const sort = BookFormat.sorts[sortIndex]!;
    const [typed, setTyped] = useState(search);
    const [listing, setListing] = useState<Listing | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [failure, setFailure] = useState<{ query: string; text: string } | null>(null);
    const editor = account?.role !== 'guest';
    const deleted = (location.state as { deleted?: string } | null)?.deleted;
    const filters = useListingFilter('books');
    const filtered = BookFilter.active(filters.filter);
    const [libraryTotal, setLibraryTotal] = useState<number | null>(null);
    const query =
        new URLSearchParams({
            search,
            sort: sort.sort,
            direction: sort.direction,
            limit: String(pageSize),
        }).toString() + (filtered ? '&' + filters.query : '');
    const fetchPage = useCallback(
        (offset: number) => api.request<BookListPageDto>('/books?' + query + '&offset=' + offset),
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

    // Searching starts shortly after typing stops.
    useEffect(() => {
        if (typed === search) {
            return;
        }

        const timer = setTimeout(() => update({ search: typed.trim() ? typed : '' }), 250);

        return () => clearTimeout(timer);
    }, [typed, search, update]);

    // The whole library's size, for "6 of 842 books" while searching or filtering.
    useEffect(() => {
        let current = true;

        api.request<BookListPageDto>('/books?limit=1').then(
            (page) => current && setLibraryTotal(page.total),
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
    const libraryEmpty = current && current.total === 0 && !narrowed;
    const clearAll = () => {
        setTyped('');
        setParameters(BookFilter.write(BookFilter.empty(), new URLSearchParams()), {
            replace: true,
        });
    };

    return (
        <>
            <PageHeader
                title={t('books.title')}
                intro={
                    current && !narrowed
                        ? current.total === 1
                            ? t('books.countOne')
                            : t('books.countMany', { count: current.total })
                        : undefined
                }
                actions={
                    editor && (
                        <Button variant="primary" icon="add" onClick={() => navigate('/books/new')}>
                            {t('books.add')}
                        </Button>
                    )
                }
            />
            <div className="stack">
                {deleted && (
                    <Notice tone="success">{t('books.deleted', { title: deleted })}</Notice>
                )}
                {!libraryEmpty && (
                    <div className="book-toolbar">
                        <div className="search-field">
                            <Icon name="search" className="search-field__icon" />
                            <label htmlFor="book-search" className="visually-hidden">
                                {t('books.searchLabel')}
                            </label>
                            <input
                                id="book-search"
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
                        <label htmlFor="book-sort" className="visually-hidden">
                            {t('books.sortLabel')}
                        </label>
                        <select
                            id="book-sort"
                            className="field__control field__control--select book-toolbar__sort"
                            value={sortIndex}
                            onChange={(event) => {
                                const choice = BookFormat.sorts[Number(event.target.value)]!;

                                update({
                                    sort:
                                        Number(event.target.value) === 0
                                            ? ''
                                            : choice.sort + '-' + choice.direction,
                                });
                            }}
                        >
                            {BookFormat.sorts.map((choice, index) => (
                                <option key={choice.label} value={index}>
                                    {t(choice.label)}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {!libraryEmpty && (filtered || (current && search)) && (
                    <div className="applied-row">
                        <AppliedFilters filter={filters.filter} onChange={filters.change} />
                        {current && libraryTotal !== null && (
                            <p className="muted applied-row__count" role="status">
                                {t('books.matching', {
                                    count: current.total,
                                    total: libraryTotal,
                                })}
                            </p>
                        )}
                    </div>
                )}
                {error && <Notice tone="error">{error}</Notice>}
                {!current && !error && <LoadingState label={t('books.loading')} />}
                {libraryEmpty && (
                    <EmptyState
                        icon="books"
                        title={editor ? t('books.empty') : t('books.emptyGuest')}
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
                        title={t('books.noMatching')}
                        body={
                            search
                                ? t('books.noMatchingSearch', { search })
                                : t('books.noMatchingFilters')
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
                        title={t('books.noResults', { search })}
                        body={t('books.noResultsHint')}
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
                        <ul className="book-grid">
                            {current.items.map((book) => (
                                <BookCard key={book.id} book={book} />
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
                    </>
                )}
            </div>
        </>
    );
}
