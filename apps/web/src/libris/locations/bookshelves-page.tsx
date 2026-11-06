import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type {
    BookcaseDto,
    BookListItemDto,
    BookListPageDto,
    ShelfDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { BookCover } from '../books/book-cover';
import { BookDraft } from '../books/book-draft.util';
import { BookFormat } from '../books/book-format.util';
import type { LocationEditing } from './location-dialogs';
import { LocationDialogs } from './location-dialogs';
import { useBookcases } from './use-bookcases';

const pageSize = 24;

// The bookcases whose name, or one of whose shelves' names, contains the search; a matching
// bookcase keeps all its shelves.
function matching(bookcases: BookcaseDto[], search: string): BookcaseDto[] {
    const key = BookDraft.nameKey(search);

    if (!key) {
        return bookcases;
    }

    return bookcases.flatMap((bookcase) => {
        if (BookDraft.nameKey(bookcase.name).includes(key)) {
            return [bookcase];
        }

        const shelves = bookcase.shelves.filter((shelf) =>
            BookDraft.nameKey(shelf.name).includes(key),
        );

        return shelves.length > 0 ? [{ ...bookcase, shelves }] : [];
    });
}

// The books kept on a shelf, by title, with paging.
function ShelfBooks({ shelf }: { shelf: ShelfDto }) {
    const { t } = useI18n();
    const [books, setBooks] = useState<{ shelf: string; items: BookListItemDto[]; total: number }>({
        shelf: '',
        items: [],
        total: 0,
    });
    const [failure, setFailure] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fetchPage = useCallback(
        (offset: number) =>
            api.request<BookListPageDto>(
                '/books?' +
                    new URLSearchParams({
                        location: 'shelf:' + shelf.id,
                        limit: String(pageSize),
                        offset: String(offset),
                    }).toString(),
            ),
        [shelf.id],
    );

    useEffect(() => {
        let current = true;

        fetchPage(0).then(
            (page) => current && setBooks({ shelf: shelf.id, ...page }),
            (error: unknown) => current && setFailure(t(ApiErrorMessage.key(error))),
        );

        return () => {
            current = false;
        };
    }, [fetchPage, shelf.id, shelf.bookCount, t]);

    if (failure) {
        return <Notice tone="error">{failure}</Notice>;
    }

    if (books.shelf !== shelf.id) {
        return <LoadingState label={t('books.loading')} />;
    }

    if (books.total === 0) {
        return <p className="muted">{t('shelf.empty')}</p>;
    }

    return (
        <>
            <ul className="shelf-books" aria-label={t('shelf.booksLabel', { name: shelf.name })}>
                {books.items.map((book) => (
                    <li key={book.id}>
                        <Link to={'/books/' + book.id} className="shelf-book">
                            <BookCover
                                src={
                                    book.hasCover ? BookFormat.cover(book.id, book.updatedAt) : null
                                }
                                title={book.title}
                                size="small"
                            />
                            <span className="shelf-book__title">{book.title}</span>
                            <span className="muted">
                                {[
                                    t(BookFormat.ownership(book.ownership)),
                                    book.loan ? t('books.lent') : null,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
            {books.items.length < books.total && (
                <div className="book-grid__more">
                    <Button
                        busy={loading}
                        onClick={() => {
                            setLoading(true);
                            fetchPage(books.items.length)
                                .then(
                                    (page) =>
                                        setBooks({
                                            shelf: shelf.id,
                                            total: page.total,
                                            items: [...books.items, ...page.items],
                                        }),
                                    (error: unknown) => setFailure(t(ApiErrorMessage.key(error))),
                                )
                                .finally(() => setLoading(false));
                        }}
                    >
                        {t('books.loadMore')}
                    </Button>
                    <span className="muted">
                        {t('books.showing', { shown: books.items.length, total: books.total })}
                    </span>
                </div>
            )}
        </>
    );
}

// Physical bookcases and the shelves inside them. Owners/Admin create, rename, move and delete
// them; deleting a location unassigns its books and never deletes them.
export function BookshelvesPage() {
    const { t } = useI18n();
    const { account } = useSession();
    const editor = account?.role !== 'guest';
    const { bookcases, failure, reload } = useBookcases();
    const [parameters, setParameters] = useSearchParams();
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<LocationEditing | null>(null);
    const [done, setDone] = useState<string | null>(null);

    if (failure) {
        return (
            <>
                <PageHeader title={t('bookshelves.title')} />
                <Notice tone="error">{t(failure)}</Notice>
            </>
        );
    }

    if (!bookcases) {
        return <LoadingState label={t('bookshelves.loading')} />;
    }

    const shelves = bookcases.flatMap((bookcase) => bookcase.shelves);
    const shelf =
        shelves.find((candidate) => candidate.id === parameters.get('shelf')) ??
        (parameters.get('bookcase') ? undefined : shelves[0]);
    const bookcase =
        bookcases.find(
            (candidate) => candidate.id === (shelf?.bookcaseId ?? parameters.get('bookcase')),
        ) ?? bookcases[0];
    const shown = matching(bookcases, search);
    const select = (selected: { shelf?: string; bookcase?: string }) =>
        setParameters(
            selected.shelf
                ? { shelf: selected.shelf }
                : selected.bookcase
                  ? { bookcase: selected.bookcase }
                  : {},
            { replace: true },
        );
    const dialogs = (
        <LocationDialogs
            bookcases={bookcases}
            editing={editing}
            onDone={(message, selected) => {
                setEditing(null);
                setDone(message);
                reload();

                if (selected) {
                    select(selected);
                }
            }}
            onClose={() => setEditing(null)}
        />
    );

    if (bookcases.length === 0) {
        return (
            <>
                <PageHeader title={t('bookshelves.title')} />
                <EmptyState
                    icon="inbox"
                    title={editor ? t('bookshelves.empty') : t('bookshelves.emptyGuest')}
                    action={
                        editor && (
                            <Button
                                variant="primary"
                                onClick={() => setEditing({ kind: 'create-bookcase' })}
                            >
                                {t('bookcase.createFirst')}
                            </Button>
                        )
                    }
                />
                {dialogs}
            </>
        );
    }

    return (
        <>
            <PageHeader
                title={t('bookshelves.title')}
                intro={t('bookshelves.intro')}
                actions={
                    editor && (
                        <Button
                            variant="primary"
                            icon="add"
                            onClick={() => setEditing({ kind: 'create-bookcase' })}
                        >
                            {t('bookcase.create')}
                        </Button>
                    )
                }
            />
            <div className="stack">
                {done && <Notice tone="success">{done}</Notice>}
                <div className="book-toolbar">
                    <div className="search-field">
                        <Icon name="search" className="search-field__icon" />
                        <label htmlFor="location-search" className="visually-hidden">
                            {t('bookshelves.searchLabel')}
                        </label>
                        <input
                            id="location-search"
                            type="search"
                            className="field__control search-field__control"
                            placeholder={t('bookshelves.searchPlaceholder')}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <span className="muted">
                        {t('bookshelves.totals', {
                            bookcases:
                                bookcases.length === 1
                                    ? t('bookshelves.bookcasesOne')
                                    : t('bookshelves.bookcasesMany', { count: bookcases.length }),
                            shelves:
                                shelves.length === 1
                                    ? t('bookshelves.shelvesOne')
                                    : t('bookshelves.shelvesMany', { count: shelves.length }),
                        })}
                    </span>
                </div>
                <div className="bookshelves">
                    <nav className="bookshelves__tree" aria-label={t('bookshelves.treeLabel')}>
                        {shown.length === 0 && (
                            <p className="muted">{t('bookshelves.noResults', { search })}</p>
                        )}
                        {shown.map((candidate) => (
                            <section key={candidate.id} className="bookcase-group">
                                <h2 className="bookcase-group__header">
                                    <button
                                        type="button"
                                        className="bookcase-group__name"
                                        aria-current={
                                            !shelf && candidate.id === bookcase?.id
                                                ? 'true'
                                                : undefined
                                        }
                                        onClick={() => select({ bookcase: candidate.id })}
                                    >
                                        {candidate.name}
                                    </button>
                                    <span className="muted">
                                        {candidate.shelves.length === 1
                                            ? t('bookshelves.shelvesOne')
                                            : t('bookshelves.shelvesMany', {
                                                  count: candidate.shelves.length,
                                              })}
                                    </span>
                                </h2>
                                <ul className="shelf-list">
                                    {candidate.shelves.map((item) => (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                className="shelf-row"
                                                aria-current={
                                                    item.id === shelf?.id ? 'true' : undefined
                                                }
                                                onClick={() => select({ shelf: item.id })}
                                            >
                                                {t('shelf.row', {
                                                    name: item.name,
                                                    books:
                                                        item.bookCount === 1
                                                            ? t('tags.booksOne')
                                                            : t('tags.booksMany', {
                                                                  count: item.bookCount,
                                                              }),
                                                })}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </nav>
                    <div className="bookshelves__detail">
                        {shelf && bookcase ? (
                            <section className="stack stack--compact">
                                <p className="eyebrow">
                                    {bookcase.name} / {shelf.name}
                                </p>
                                <h2 className="panel__title">
                                    {shelf.bookCount === 1
                                        ? t('shelf.headingOne', { name: shelf.name })
                                        : t('shelf.headingMany', {
                                              name: shelf.name,
                                              count: shelf.bookCount,
                                          })}
                                </h2>
                                {editor && (
                                    <div className="actions">
                                        <Button
                                            icon="edit"
                                            onClick={() =>
                                                setEditing({ kind: 'rename-shelf', shelf })
                                            }
                                        >
                                            {t('shelf.rename')}
                                        </Button>
                                        <Button
                                            icon="move"
                                            onClick={() =>
                                                setEditing({ kind: 'move-shelf', shelf })
                                            }
                                        >
                                            {t('shelf.move')}
                                        </Button>
                                        <Button
                                            variant="danger"
                                            icon="delete"
                                            onClick={() =>
                                                setEditing({ kind: 'delete-shelf', shelf })
                                            }
                                        >
                                            {t('shelf.delete')}
                                        </Button>
                                    </div>
                                )}
                                <ShelfBooks shelf={shelf} />
                            </section>
                        ) : (
                            <p className="muted">
                                {editor ? t('bookshelves.noShelf') : t('bookshelves.noShelfGuest')}
                            </p>
                        )}
                        {bookcase && (
                            <section className="panel bookcase-card">
                                <p className="eyebrow">{t('bookcase.actions')}</p>
                                <h2 className="panel__title">{bookcase.name}</h2>
                                {editor && (
                                    <div className="actions">
                                        <Button
                                            icon="add"
                                            onClick={() =>
                                                setEditing({ kind: 'create-shelf', bookcase })
                                            }
                                        >
                                            {t('shelf.add')}
                                        </Button>
                                        <Button
                                            icon="edit"
                                            onClick={() =>
                                                setEditing({ kind: 'rename-bookcase', bookcase })
                                            }
                                        >
                                            {t('bookcase.rename')}
                                        </Button>
                                        <Button
                                            variant="danger"
                                            icon="delete"
                                            onClick={() =>
                                                setEditing({ kind: 'delete-bookcase', bookcase })
                                            }
                                        >
                                            {t('bookcase.delete')}
                                        </Button>
                                    </div>
                                )}
                                <p className="muted">{t('bookshelves.footnote')}</p>
                            </section>
                        )}
                    </div>
                </div>
            </div>
            {dialogs}
        </>
    );
}
