import { forwardRef, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type {
    BookcaseDto,
    BookListItemDto,
    ShelfDto,
} from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { ColumnsSizes } from './columns-sizes';
import { MoveBookDialog } from './move-book-dialog';
import { SpineLayout } from './spine-layout.util';
import { ShelfBookFormat } from './shelf-book-format.util';
import { useBookStatus } from './use-book-status';
import { useShelfBooks } from './use-shelf-books';

const steps: Partial<Record<string, (index: number, last: number) => number>> = {
    ArrowDown: (index, last) => Math.min(last, index + 1),
    ArrowUp: (index) => Math.max(0, index - 1),
    Home: () => 0,
    End: (_, last) => last,
};

export const ShelfBooksTable = forwardRef<
    HTMLTableElement,
    {
        bookcases: BookcaseDto[];
        shelf: ShelfDto;
        editor: boolean;
        onMoved(message: string): void;
        onLeave(): void;
    }
>(function ShelfBooksTable({ bookcases, shelf, editor, onMoved, onLeave }, ref) {
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const status = useBookStatus();
    const scroller = useRef<HTMLDivElement>(null);
    const rows = useRef<(HTMLTableRowElement | null)[]>([]);
    const [view, setView] = useState({ top: 0, height: 0 });
    const [active, setActive] = useState(0);
    const [moving, setMoving] = useState<BookListItemDto | null>(null);
    const firstShown = Math.floor(view.top / ColumnsSizes.rowHeight);
    const lastShown =
        view.height === 0 ? null : Math.ceil((view.top + view.height) / ColumnsSizes.rowHeight) - 1;
    const books = useShelfBooks(shelf, (lastShown ?? 0) + 1 + ColumnsSizes.lookAhead, true);
    const items = books.items;
    const loaded = books.total !== null;

    useEffect(() => {
        const element = scroller.current;

        if (loaded && element) {
            setView({ top: element.scrollTop, height: element.clientHeight });
        }
    }, [loaded]);
    const total = books.total === null ? shelf.bookCount : books.total;
    const focused = Math.min(active, Math.max(0, items.length - 1));
    const number = new Intl.NumberFormat(locale);
    const move = (
        event: KeyboardEvent<HTMLTableRowElement>,
        book: BookListItemDto,
        index: number,
    ) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onLeave();

            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            void navigate('/books/' + book.id);

            return;
        }

        if (editor && (event.key === 'm' || event.key === 'M')) {
            event.preventDefault();
            setMoving(book);

            return;
        }

        const next = steps[event.key]?.(index, items.length - 1);

        if (next !== undefined) {
            event.preventDefault();
            setActive(next);
            rows.current[next]?.focus();
        }
    };

    if (total === 0) {
        return <p className="muted columns-view__empty">{t('shelf.empty')}</p>;
    }

    if (books.failure) {
        return <Notice tone="error">{t(books.failure)}</Notice>;
    }

    if (books.total === null) {
        return <LoadingState label={t('books.loading')} />;
    }

    const last = Math.min(items.length, lastShown === null ? items.length : lastShown + 1);

    return (
        <>
            <div
                ref={scroller}
                className="columns-view__scroller"
                onScroll={(event) =>
                    setView({
                        top: event.currentTarget.scrollTop,
                        height: event.currentTarget.clientHeight,
                    })
                }
            >
                <table
                    ref={ref}
                    className="columns-table"
                    aria-label={t('shelf.booksLabel', { name: shelf.name })}
                    style={
                        { '--columns-row-height': ColumnsSizes.rowHeight + 'px' } as CSSProperties
                    }
                >
                    <thead>
                        <tr>
                            <th scope="col">{t('columns.title')}</th>
                            <th scope="col">{t('columns.author')}</th>
                            <th scope="col">{t('columns.collection')}</th>
                            <th scope="col">{t('columns.status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((book, index) => (
                            <tr
                                key={book.id}
                                ref={(row) => {
                                    rows.current[index] = row;
                                }}
                                tabIndex={index === focused ? 0 : -1}
                                onFocus={() => setActive(index)}
                                onKeyDown={(event) => move(event, book, index)}
                            >
                                <td>
                                    <span
                                        className="columns-table__mark"
                                        aria-hidden="true"
                                        style={{
                                            background:
                                                'var(--color-spine-' +
                                                (SpineLayout.colour(book.id) + 1) +
                                                ')',
                                        }}
                                    />
                                    <Link to={'/books/' + book.id} tabIndex={-1}>
                                        {book.title}
                                    </Link>
                                </td>
                                <td>{book.authors.join(', ')}</td>
                                <td>
                                    {ShelfBookFormat.collection(book, t('columns.noCollection'))}
                                </td>
                                <td className={book.loan ? 'columns-table__lent' : undefined}>
                                    <span>{status(book)}</span>
                                    {editor && (
                                        <button
                                            type="button"
                                            className="columns-table__move"
                                            tabIndex={-1}
                                            aria-label={t('columns.moveLabel', {
                                                title: book.title,
                                            })}
                                            onClick={() => setMoving(book)}
                                        >
                                            <Icon name="move" size={14} />
                                            {t('columns.move')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="columns-view__footer">
                <span>
                    {t('columns.range', {
                        first: number.format(Math.min(firstShown + 1, last)),
                        last: number.format(last),
                        total: number.format(total),
                    })}
                </span>
                <span className="columns-view__keys">
                    <kbd>{t('columns.keyArrows')}</kbd> {t('columns.hintArrows')}
                </span>
                <span>
                    <kbd>{t('columns.keyEnter')}</kbd> {t('columns.hintEnter')}
                </span>
                {editor && (
                    <span>
                        <kbd>M</kbd> {t('columns.hintMove')}
                    </span>
                )}
            </div>
            <MoveBookDialog
                book={moving}
                bookcases={bookcases}
                from={{ bookcaseId: shelf.bookcaseId, shelfId: shelf.id }}
                onMoved={(moved) => {
                    setMoving(null);
                    books.remove(moved.book.id);
                    onMoved(moved.message);
                }}
                onClose={() => setMoving(null)}
            />
        </>
    );
});
