import { useId } from 'react';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';

export function BookcaseGroup({
    bookcase,
    open,
    toggleable,
    current,
    currentShelf,
    onSelectBookcase,
    onSelectShelf,
    onToggle,
}: {
    bookcase: BookcaseDto;
    open: boolean;
    toggleable: boolean;
    current: boolean;
    currentShelf: string | undefined;
    onSelectBookcase: () => void;
    onSelectShelf: (shelf: string) => void;
    onToggle: () => void;
}) {
    const { t } = useI18n();
    const id = useId();

    return (
        <section className="bookcase-group">
            <h2 className="bookcase-group__header">
                <button
                    type="button"
                    className="icon-button bookcase-group__toggle"
                    aria-label={t('bookshelves.toggle', { name: bookcase.name })}
                    aria-expanded={open}
                    aria-controls={id}
                    disabled={!toggleable}
                    onClick={onToggle}
                >
                    <Icon name={open ? 'collapse' : 'expand'} size={16} />
                </button>
                <button
                    type="button"
                    className="bookcase-group__name"
                    aria-current={current ? 'true' : undefined}
                    onClick={onSelectBookcase}
                >
                    {bookcase.name}
                </button>
                <span className="muted bookcase-group__count">
                    {bookcase.shelves.length === 1
                        ? t('bookshelves.shelvesOne')
                        : t('bookshelves.shelvesMany', { count: bookcase.shelves.length })}
                </span>
            </h2>
            <ul id={id} className="shelf-list" hidden={!open}>
                {bookcase.shelves.map((item) => (
                    <li key={item.id}>
                        <button
                            type="button"
                            className="shelf-row"
                            aria-current={item.id === currentShelf ? 'true' : undefined}
                            onClick={() => onSelectShelf(item.id)}
                        >
                            {t('shelf.row', {
                                name: item.name,
                                books:
                                    item.bookCount === 1
                                        ? t('tags.booksOne')
                                        : t('tags.booksMany', { count: item.bookCount }),
                            })}
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
