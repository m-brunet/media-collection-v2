import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type {
    BookcaseDto,
    BookListPageDto,
    ShelfDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { BookCover } from '../books/book-cover';
import { BookFilter } from '../filters/book-filter.util';
import type { LocationEditing } from './location-dialogs';
import { ShelfPlacement } from './shelf-placement.util';
import { useElementWidth } from './use-element-width';
import { WallSizes } from './wall-sizes';

function useShelfCovers(shelf: ShelfDto) {
    const [loaded, setLoaded] = useState<{ of: ShelfDto; value: BookListPageDto } | null>(null);
    const [failure, setFailure] = useState<{ of: ShelfDto; key: MessageKey } | null>(null);

    useEffect(() => {
        let current = true;
        const query = new URLSearchParams({
            location: 'shelf:' + shelf.id,
            sort: 'shelf',
            limit: String(WallSizes.panelCoversMax),
        });

        api.request<BookListPageDto>('/books?' + query.toString()).then(
            (value) => current && setLoaded({ of: shelf, value }),
            (error: unknown) =>
                current && setFailure({ of: shelf, key: ApiErrorMessage.key(error) }),
        );

        return () => {
            current = false;
        };
    }, [shelf]);

    return {
        page: loaded?.of === shelf ? loaded.value : null,
        failure: failure?.of === shelf ? failure.key : null,
    };
}

function ShelfCovers({ shelf, columns }: { shelf: ShelfDto; columns: number }) {
    const { t } = useI18n();
    const { page, failure } = useShelfCovers(shelf);
    const inBooks =
        '/books?' +
        BookFilter.write({ ...BookFilter.empty(), location: ['shelf:' + shelf.id] }).toString();

    if (failure) {
        return <Notice tone="error">{t(failure)}</Notice>;
    }

    if (!page) {
        return <LoadingState label={t('books.loading')} />;
    }

    if (page.total === 0) {
        return <p className="muted">{t('shelf.empty')}</p>;
    }

    const places = columns * 2;
    const shown = page.total <= places ? page.items : page.items.slice(0, places - 1);
    const more = page.total - shown.length;

    return (
        <>
            <ul
                className="shelf-panel__covers"
                style={{ gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))' }}
                aria-label={t('wall.coversLabel', { name: shelf.name })}
            >
                {shown.map((book) => (
                    <li key={book.id}>
                        <Link
                            to={'/books/' + book.id}
                            className="shelf-panel__cover"
                            aria-label={[book.title, ...book.authors].join(' · ')}
                        >
                            <BookCover
                                src={
                                    book.hasCover ? BookFormat.cover(book.id, book.updatedAt) : null
                                }
                                title={book.title}
                                size="small"
                            />
                            {book.loan && (
                                <span className="shelf-panel__lent">{t('books.lent')}</span>
                            )}
                        </Link>
                    </li>
                ))}
                {more > 0 && (
                    <li>
                        <Link
                            to={inBooks}
                            className="shelf-panel__more"
                            aria-label={t('wall.moreLabel', { count: more, name: shelf.name })}
                        >
                            {t('wall.more', { count: more })}
                        </Link>
                    </li>
                )}
            </ul>
            <Link to={inBooks} className="shelf-panel__link">
                {t('wall.openInBooks')}
                <Icon name="expand" />
            </Link>
        </>
    );
}

export function ShelfPanel({
    bookcase,
    shelf,
    editor,
    onEdit,
}: {
    bookcase: BookcaseDto;
    shelf: ShelfDto | null;
    editor: boolean;
    onEdit(editing: LocationEditing): void;
}) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const panel = useRef<HTMLElement>(null);
    const width = useElementWidth(panel);
    const columns =
        width === null
            ? WallSizes.panelColumns
            : Math.min(
                  WallSizes.panelCoversMax / 2,
                  Math.max(
                      3,
                      Math.floor(
                          (width + WallSizes.coverGap) /
                              (WallSizes.coverMinWidth + WallSizes.coverGap),
                      ),
                  ),
              );

    return (
        <aside ref={panel} className="panel shelf-panel" aria-label={t('wall.panelLabel')}>
            {shelf ? (
                <>
                    <div>
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
                    </div>
                    <ShelfCovers shelf={shelf} columns={columns} />
                    {editor && (
                        <div className="actions shelf-panel__actions">
                            <Button
                                icon="add"
                                onClick={() => navigate(ShelfPlacement.opening(shelf.id))}
                            >
                                {t('shelf.addBooks')}
                            </Button>
                            <Button
                                icon="edit"
                                onClick={() => onEdit({ kind: 'rename-shelf', shelf })}
                            >
                                {t('shelf.rename')}
                            </Button>
                            <Button
                                icon="move"
                                onClick={() => onEdit({ kind: 'move-shelf', shelf })}
                            >
                                {t('shelf.move')}
                            </Button>
                            <Button
                                variant="danger"
                                icon="delete"
                                onClick={() => onEdit({ kind: 'delete-shelf', shelf })}
                            >
                                {t('shelf.delete')}
                            </Button>
                        </div>
                    )}
                    <p className="muted shelf-panel__hint">{t('wall.hint')}</p>
                </>
            ) : (
                <p className="muted">
                    {editor ? t('bookshelves.noShelf') : t('bookshelves.noShelfGuest')}
                </p>
            )}
        </aside>
    );
}
