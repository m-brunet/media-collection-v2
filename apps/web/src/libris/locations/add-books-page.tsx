import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import type {
    BookListItemDto,
    BookListPageDto,
    ShelfPlacementDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { AppliedFilters } from '../filters/applied-filters';
import type { Filter } from '../filters/book-filter.util';
import { BookFilter } from '../filters/book-filter.util';
import { maximumChosen, useAddBooksSelection } from './add-books-selection';
import { ColumnsSizes } from './columns-sizes';
import { LocationFormat } from './location-format.util';
import { ShelfBookFormat } from './shelf-book-format.util';
import { useBookStatus } from './use-book-status';
import { ShelfPlacement } from './shelf-placement.util';
import { useBookcases } from './use-bookcases';

const pageSize = 48;

interface Listing {
    query: string;
    total: number;
    items: BookListItemDto[];
}

export function AddBooksPage() {
    const { t, locale } = useI18n();
    const { shelfId = '' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [parameters, setParameters] = useSearchParams();
    const { bookcases, failure: bookcasesFailure } = useBookcases();
    const selection = useAddBooksSelection();
    const status = useBookStatus();
    const search = parameters.get('search') ?? '';
    const [typed, setTyped] = useState(search);
    const [listing, setListing] = useState<Listing | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [limited, setLimited] = useState(false);
    const filter: Filter = {
        ...BookFilter.applicable(BookFilter.read(parameters), { guest: false, collections: false }),
        ownership: [],
    };
    const criteria = BookFilter.write(filter);

    criteria.set('search', search);
    criteria.set('sort', 'title');
    criteria.set('direction', 'asc');
    criteria.set('ownership', 'owned');
    const query = criteria.toString();
    const change = useCallback(
        (next: URLSearchParams) => setParameters(next, { replace: true, state: location.state }),
        [setParameters, location.state],
    );

    useEffect(() => {
        if (typed === search) {
            return;
        }

        const timer = setTimeout(() => {
            const next = new URLSearchParams(parameters);

            if (typed.trim()) {
                next.set('search', typed);
            } else {
                next.delete('search');
            }

            change(next);
        }, 250);

        return () => clearTimeout(timer);
    }, [typed, search, parameters, change]);

    useEffect(() => {
        let current = true;

        api.request<BookListPageDto>('/books?' + query + '&limit=' + pageSize + '&offset=0').then(
            (page) => {
                if (current) {
                    setListing({ query, total: page.total, items: page.items });
                    setFailure(null);
                }
            },
            (error: unknown) => current && setFailure(t(ApiErrorMessage.key(error))),
        );

        return () => {
            current = false;
        };
    }, [query, t]);

    const place = bookcases ? LocationFormat.of(bookcases, shelfId) : null;
    const shelf = bookcases
        ?.flatMap((bookcase) => bookcase.shelves)
        .find((candidate) => candidate.id === shelfId);
    const back =
        '/bookshelves?' +
        new URLSearchParams({ bookcase: shelf?.bookcaseId ?? '', shelf: shelfId }).toString();

    if (bookcasesFailure) {
        return <Notice tone="error">{t(bookcasesFailure)}</Notice>;
    }

    if (!bookcases) {
        return <LoadingState label={t('bookshelves.loading')} />;
    }

    if (!shelf || !place) {
        return (
            <>
                <PageHeader title={t('addBooks.unknownShelfTitle')} />
                <Notice tone="error">{t('addBooks.unknownShelf')}</Notice>
                <p>
                    <Link to="/bookshelves">{t('addBooks.backToBookshelves')}</Link>
                </p>
            </>
        );
    }

    const current = listing?.query === query ? listing : null;
    const chosen = [...selection.chosen.values()];
    const count = chosen.length;
    const here = (book: BookListItemDto) => book.location?.shelfId === shelfId;
    const loadMore = () => {
        if (!current || loadingMore || current.items.length >= current.total) {
            return;
        }

        setLoadingMore(true);
        api.request<BookListPageDto>(
            '/books?' + query + '&limit=' + pageSize + '&offset=' + current.items.length,
        )
            .then(
                (page) =>
                    setListing((previous) =>
                        previous?.query === query && previous.items.length === current.items.length
                            ? { ...previous, items: [...previous.items, ...page.items] }
                            : previous,
                    ),
                (error: unknown) => setFailure(t(ApiErrorMessage.key(error))),
            )
            .finally(() => setLoadingMore(false));
    };
    const selectAll = () => {
        api.request<BookListPageDto>(
            '/books?' + query + '&limit=' + maximumChosen + '&offset=0',
        ).then(
            (page) => {
                const addable = page.items.filter(
                    (book) => !here(book) && !selection.chosen.has(book.id),
                );

                setLimited(selection.chosen.size + addable.length > maximumChosen);
                selection.add(addable);
            },
            (error: unknown) => setFailure(t(ApiErrorMessage.key(error))),
        );
    };
    const toggle = (book: BookListItemDto) => {
        setLimited(selection.full && !selection.chosen.has(book.id));
        selection.toggle(book);
    };
    const save = () => {
        setSaving(true);
        setFailure(null);
        api.request<ShelfPlacementDto>('/books/shelf-placement', {
            method: 'POST',
            body: { shelfId, bookIds: chosen.map((book) => book.id) },
        }).then(
            (result) => navigate(back, { state: { done: ShelfPlacement.done(result, t, locale) } }),
            (error: unknown) => {
                setSaving(false);
                setFailure(t(ApiErrorMessage.key(error)));
            },
        );
    };
    const tooMany = current !== null && current.total > maximumChosen;

    return (
        <div className="add-books">
            <PageHeader
                title={t('addBooks.title', { shelf: shelf.name })}
                intro={t(shelf.bookCount === 1 ? 'addBooks.introOne' : 'addBooks.intro', {
                    bookcase: place.bookcaseName,
                    count: shelf.bookCount,
                })}
                breadcrumb={
                    <nav className="breadcrumb" aria-label={t('addBooks.breadcrumb')}>
                        <Link to="/bookshelves">{t('bookshelves.title')}</Link>
                        <Icon name="next" size={12} />
                        <Link to={back}>{LocationFormat.label(place)}</Link>
                    </nav>
                }
            />
            <div className="add-books__toolbar">
                <div className="search-field">
                    <Icon name="search" className="search-field__icon" />
                    <label htmlFor="add-books-search" className="visually-hidden">
                        {t('books.searchLabel')}
                    </label>
                    <input
                        id="add-books-search"
                        type="search"
                        className="field__control search-field__control"
                        placeholder={t('books.searchPlaceholder')}
                        value={typed}
                        onChange={(event) => setTyped(event.target.value)}
                    />
                </div>
                <span className="add-books__fixed" title={t('addBooks.ownedHint')}>
                    {t('addBooks.owned')}
                    <span className="visually-hidden">{t('addBooks.ownedHint')}</span>
                </span>
                <AppliedFilters
                    filter={filter}
                    onChange={(next) => change(BookFilter.write(next, parameters))}
                />
                <Button
                    icon="filter"
                    onClick={() =>
                        navigate(ShelfPlacement.path(shelfId) + '/filters?' + parameters.toString())
                    }
                >
                    {t('filters.open')}
                </Button>
            </div>
            {failure && <Notice tone="error">{failure}</Notice>}
            <section className="panel add-books__panel" aria-label={t('addBooks.books')}>
                <div className="add-books__count">
                    <strong>
                        {current
                            ? t(current.total === 1 ? 'addBooks.matchOne' : 'addBooks.match', {
                                  count: current.total,
                              })
                            : t('books.loading')}
                    </strong>
                    {(tooMany || limited) && (
                        <span className="muted" role="status">
                            {t('addBooks.limit')}
                        </span>
                    )}
                    <span className="add-books__spacer" />
                    {count > 0 && (
                        <Button
                            onClick={() => {
                                setLimited(false);
                                selection.clear();
                            }}
                        >
                            {t('addBooks.clearSelection')}
                        </Button>
                    )}
                    <Button
                        disabled={current === null || current.total === 0 || tooMany}
                        onClick={selectAll}
                    >
                        {t('addBooks.selectAll')}
                    </Button>
                </div>
                <div
                    className="columns-view__scroller"
                    onScroll={(event) => {
                        const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;

                        if (
                            scrollTop + clientHeight >=
                            scrollHeight - 10 * ColumnsSizes.rowHeight
                        ) {
                            loadMore();
                        }
                    }}
                >
                    {current && current.total === 0 ? (
                        <p className="muted columns-view__empty">{t('addBooks.empty')}</p>
                    ) : (
                        <table
                            className="columns-table add-books__table"
                            aria-label={t('addBooks.tableLabel', { shelf: shelf.name })}
                            style={
                                {
                                    '--columns-row-height': ColumnsSizes.rowHeight + 'px',
                                } as CSSProperties
                            }
                        >
                            <thead>
                                <tr>
                                    <th scope="col">{t('columns.title')}</th>
                                    <th scope="col">{t('columns.author')}</th>
                                    <th scope="col">{t('columns.collection')}</th>
                                    <th scope="col">{t('addBooks.location')}</th>
                                    <th scope="col">{t('columns.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(current?.items ?? []).map((book) => {
                                    const ticked = selection.chosen.has(book.id);

                                    return (
                                        <tr
                                            key={book.id}
                                            className={
                                                here(book)
                                                    ? 'add-books__row--here'
                                                    : ticked
                                                      ? 'add-books__row--chosen'
                                                      : undefined
                                            }
                                        >
                                            <td>
                                                <label className="add-books__tick">
                                                    <input
                                                        type="checkbox"
                                                        checked={ticked}
                                                        disabled={here(book)}
                                                        onChange={() => toggle(book)}
                                                    />
                                                    <span>{book.title}</span>
                                                </label>
                                            </td>
                                            <td>{book.authors.join(', ')}</td>
                                            <td>
                                                {ShelfBookFormat.collection(
                                                    book,
                                                    t('columns.noCollection'),
                                                )}
                                            </td>
                                            <td>
                                                {here(book) ? (
                                                    <span className="add-books__here">
                                                        {t('addBooks.alreadyHere')}
                                                    </span>
                                                ) : book.location ? (
                                                    LocationFormat.label(book.location)
                                                ) : (
                                                    t('addBooks.noLocation')
                                                )}
                                            </td>
                                            <td
                                                className={
                                                    book.loan ? 'columns-table__lent' : undefined
                                                }
                                            >
                                                {status(book)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="add-books__footer">
                    <div>
                        <p className="add-books__chosen">
                            {count === 0
                                ? t('addBooks.chosenNone')
                                : t(count === 1 ? 'addBooks.chosenOne' : 'addBooks.chosen', {
                                      count,
                                  })}
                        </p>
                        {count > 0 && (
                            <p className="muted">
                                {ShelfPlacement.summary(chosen, shelf.name, t, locale)}
                            </p>
                        )}
                    </div>
                    <span className="add-books__spacer" />
                    <Button onClick={() => navigate(back)}>{t('common.cancel')}</Button>
                    <Button variant="primary" disabled={count === 0} busy={saving} onClick={save}>
                        {count === 0
                            ? t('addBooks.submitNone', { shelf: shelf.name })
                            : t(count === 1 ? 'addBooks.submitOne' : 'addBooks.submit', {
                                  count,
                                  shelf: shelf.name,
                              })}
                    </Button>
                </div>
            </section>
        </div>
    );
}
