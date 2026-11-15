import { useRef } from 'react';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { MenuButton } from '../../shared/ui/menu-button';
import type { BookshelvesViewProps } from './bookshelves-view';
import { ColumnsList } from './columns-list';
import { ShelfBooksTable } from './shelf-books-table';
import { useLocationCounts } from './use-location-counts';

function focusIn(element: HTMLElement | null) {
    element?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
}

export function ColumnsView({
    bookcases,
    bookcase,
    shelf,
    editor,
    onSelect,
    onEdit,
    onChanged,
}: BookshelvesViewProps) {
    const { t, locale } = useI18n();
    const counts = useLocationCounts();
    const number = new Intl.NumberFormat(locale);
    const bookcaseList = useRef<HTMLUListElement>(null);
    const shelfList = useRef<HTMLUListElement>(null);
    const table = useRef<HTMLTableElement>(null);
    const shelvesLabel = t('columns.shelvesOf', { name: bookcase.name });

    return (
        <div className="panel columns-view">
            <section className="columns-view__column" aria-label={t('wall.bookcases')}>
                <div className="columns-view__head">
                    <span>{t('wall.bookcases')}</span>
                    <span>{number.format(bookcases.length)}</span>
                </div>
                <ColumnsList
                    ref={bookcaseList}
                    label={t('wall.bookcases')}
                    entries={bookcases.map((entry) => ({
                        id: entry.id,
                        name: entry.name,
                        count: number.format(entry.bookCount),
                    }))}
                    selected={bookcase.id}
                    onChoose={(id) => onSelect({ bookcase: id })}
                    onLeave={(side) => {
                        if (side === 'next') {
                            focusIn(shelfList.current);
                        }
                    }}
                />
                {editor && (
                    <button
                        type="button"
                        className="columns-view__add"
                        onClick={() => onEdit({ kind: 'create-bookcase' })}
                    >
                        <Icon name="add" size={16} />
                        {t('bookcase.create')}
                    </button>
                )}
            </section>
            <section className="columns-view__column" aria-label={shelvesLabel}>
                <div className="columns-view__head">
                    <span>{bookcase.name}</span>
                    <span>{counts.shelves(bookcase.shelves.length)}</span>
                    {editor && (
                        <MenuButton
                            label={t('columns.bookcaseActions', { name: bookcase.name })}
                            actions={[
                                {
                                    label: t('bookcase.rename'),
                                    icon: 'edit',
                                    onSelect: () => onEdit({ kind: 'rename-bookcase', bookcase }),
                                },
                                {
                                    label: t('bookcase.delete'),
                                    icon: 'delete',
                                    danger: true,
                                    onSelect: () => onEdit({ kind: 'delete-bookcase', bookcase }),
                                },
                            ]}
                        />
                    )}
                </div>
                <ColumnsList
                    ref={shelfList}
                    label={shelvesLabel}
                    entries={bookcase.shelves.map((entry) => ({
                        id: entry.id,
                        name: entry.name,
                        count: number.format(entry.bookCount),
                    }))}
                    selected={shelf?.id ?? null}
                    onChoose={(id) => onSelect({ bookcase: bookcase.id, shelf: id })}
                    onLeave={(side) =>
                        focusIn(side === 'previous' ? bookcaseList.current : table.current)
                    }
                />
                {editor && (
                    <button
                        type="button"
                        className="columns-view__add"
                        onClick={() => onEdit({ kind: 'create-shelf', bookcase })}
                    >
                        <Icon name="add" size={16} />
                        {t('shelf.add')}
                    </button>
                )}
            </section>
            <section className="columns-view__books" aria-labelledby="columns-shelf-name">
                {shelf ? (
                    <>
                        <div className="columns-view__shelf">
                            <h2 id="columns-shelf-name" className="panel__title">
                                {shelf.name}
                            </h2>
                            <span className="muted">{counts.books(shelf.bookCount)}</span>
                            {editor && (
                                <div className="actions columns-view__actions">
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
                        </div>
                        <ShelfBooksTable
                            key={shelf.id}
                            ref={table}
                            bookcases={bookcases}
                            shelf={shelf}
                            editor={editor}
                            onMoved={onChanged}
                            onLeave={() => focusIn(shelfList.current)}
                        />
                    </>
                ) : (
                    <p id="columns-shelf-name" className="muted columns-view__empty">
                        {editor ? t('bookshelves.noShelf') : t('bookshelves.noShelfGuest')}
                    </p>
                )}
            </section>
        </div>
    );
}
