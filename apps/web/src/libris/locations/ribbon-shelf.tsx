import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { BookListItemDto, ShelfDto } from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';
import { MenuButton } from '../../shared/ui/menu-button';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { BookCover } from '../books/book-cover';
import { BookFilter } from '../filters/book-filter.util';
import type { LocationEditing } from './location-dialogs';
import { ShelfPlacement } from './shelf-placement.util';
import { RibbonWindow } from './ribbon-window.util';
import { useElementWidth } from './use-element-width';
import { useInView } from './use-in-view';
import { useLocationCounts } from './use-location-counts';
import { useShelfBooks } from './use-shelf-books';

function RibbonCover({
    book,
    pointed,
    end,
}: {
    book: BookListItemDto;
    pointed: boolean;
    end: boolean;
}) {
    const { t } = useI18n();
    const authors = book.authors.join(', ');

    return (
        <>
            <Link
                to={'/books/' + book.id}
                className="ribbon__cover"
                aria-label={[book.title, ...(authors ? [authors] : [])].join(' · ')}
            >
                <BookCover
                    src={book.hasCover ? BookFormat.cover(book.id, book.updatedAt) : null}
                    title={book.title}
                    size="small"
                />
                {book.loan && <span className="ribbon__lent">{t('books.lent')}</span>}
            </Link>
            {pointed && (
                <span
                    className={end ? 'ribbon__card ribbon__card--end' : 'ribbon__card'}
                    aria-hidden="true"
                >
                    <b>{book.title}</b>
                    {[
                        ...(authors ? [authors] : []),
                        ...BookFormat.status(book).map((key) => t(key)),
                    ].join(' · ')}
                </span>
            )}
        </>
    );
}

export function RibbonShelf({
    shelf,
    editor,
    onEdit,
}: {
    shelf: ShelfDto;
    editor: boolean;
    onEdit(editing: LocationEditing): void;
}) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const counts = useLocationCounts();
    const strip = useRef<HTMLDivElement>(null);
    const width = useElementWidth(strip);
    const seen = useInView(strip);
    const [start, setStart] = useState(0);
    const [pointed, setPointed] = useState<string | null>(null);
    const ribbon = useShelfBooks(shelf, start + RibbonWindow.places(width, start > 0), seen);
    const total = ribbon.total ?? shelf.bookCount;
    const page = RibbonWindow.page(start, width, total);
    const shown = ribbon.items.slice(page.start, page.start + page.count);
    const inBooks =
        '/books?' +
        BookFilter.write({ ...BookFilter.empty(), location: ['shelf:' + shelf.id] }).toString();
    const next = () => setStart(page.next);

    return (
        <div className="ribbon">
            <div className="ribbon__label">
                <div className="ribbon__name">
                    <Link to={inBooks}>{shelf.name}</Link>
                    {editor && (
                        <MenuButton
                            label={t('ribbons.shelfActions', { name: shelf.name })}
                            actions={[
                                {
                                    label: t('shelf.addBooks'),
                                    icon: 'add',
                                    onSelect: () => navigate(ShelfPlacement.opening(shelf.id)),
                                },
                                {
                                    label: t('shelf.rename'),
                                    icon: 'edit',
                                    onSelect: () => onEdit({ kind: 'rename-shelf', shelf }),
                                },
                                {
                                    label: t('shelf.move'),
                                    icon: 'move',
                                    onSelect: () => onEdit({ kind: 'move-shelf', shelf }),
                                },
                                {
                                    label: t('shelf.delete'),
                                    icon: 'delete',
                                    danger: true,
                                    onSelect: () => onEdit({ kind: 'delete-shelf', shelf }),
                                },
                            ]}
                        />
                    )}
                </div>
                <small>{counts.books(shelf.bookCount)}</small>
            </div>
            <div ref={strip} className="ribbon__strip">
                {total === 0 ? (
                    <p className="muted">{t('shelf.empty')}</p>
                ) : ribbon.failure ? (
                    <Notice tone="error">{t(ribbon.failure)}</Notice>
                ) : shown.length < page.count || ribbon.total === null ? (
                    <LoadingState label={t('books.loading')} />
                ) : (
                    <>
                        {page.start > 0 && (
                            <button
                                type="button"
                                className="ribbon__arrow"
                                aria-label={t('ribbons.previous', { name: shelf.name })}
                                onClick={() => setStart(page.previous)}
                            >
                                <Icon name="previous" size={16} />
                            </button>
                        )}
                        <ul
                            className="ribbon__covers"
                            aria-label={t('shelf.booksLabel', { name: shelf.name })}
                        >
                            {shown.map((book, index) => (
                                <li
                                    key={book.id}
                                    onMouseEnter={() => setPointed(book.id)}
                                    onMouseLeave={() => setPointed(null)}
                                    onFocus={() => setPointed(book.id)}
                                    onBlur={() => setPointed(null)}
                                >
                                    <RibbonCover
                                        book={book}
                                        pointed={pointed === book.id}
                                        end={index >= shown.length / 2}
                                    />
                                </li>
                            ))}
                            {page.more > 0 && (
                                <li>
                                    <button
                                        type="button"
                                        className="ribbon__more"
                                        aria-label={t('ribbons.moreLabel', {
                                            count: page.more,
                                            name: shelf.name,
                                        })}
                                        onClick={next}
                                    >
                                        {t('ribbons.more', { count: page.more })}
                                    </button>
                                </li>
                            )}
                        </ul>
                        <button
                            type="button"
                            className="ribbon__arrow ribbon__arrow--next"
                            aria-label={t('ribbons.next', { name: shelf.name })}
                            hidden={page.more === 0}
                            onClick={next}
                        >
                            <Icon name="next" size={16} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
