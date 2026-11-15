import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { BookcaseActions } from './bookcase-actions';
import type { BookshelvesViewProps } from './bookshelves-view';
import { RibbonShelf } from './ribbon-shelf';
import { useLocationCounts } from './use-location-counts';

const moves: Partial<Record<string, (index: number, last: number) => number>> = {
    ArrowRight: (index, last) => (index === last ? 0 : index + 1),
    ArrowLeft: (index, last) => (index === 0 ? last : index - 1),
    Home: () => 0,
    End: (_, last) => last,
};

function tabId(bookcase: BookcaseDto) {
    return 'ribbons-tab-' + bookcase.id;
}

function BookcaseTabs({
    bookcases,
    open,
    onOpen,
}: {
    bookcases: BookcaseDto[];
    open: BookcaseDto;
    onOpen(bookcase: BookcaseDto): void;
}) {
    const { t } = useI18n();
    const counts = useLocationCounts();
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const move = (event: KeyboardEvent, index: number) => {
        const next = moves[event.key]?.(index, bookcases.length - 1);
        const bookcase = next === undefined ? undefined : bookcases[next];

        if (next === undefined || !bookcase) {
            return;
        }

        event.preventDefault();
        tabs.current[next]?.focus();
        onOpen(bookcase);
    };

    return (
        <div className="ribbons-tabs" role="tablist" aria-label={t('wall.bookcases')}>
            {bookcases.map((bookcase, index) => (
                <button
                    key={bookcase.id}
                    ref={(tab) => {
                        tabs.current[index] = tab;
                    }}
                    id={tabId(bookcase)}
                    type="button"
                    role="tab"
                    className="ribbons-tabs__tab"
                    aria-selected={bookcase.id === open.id}
                    aria-controls="ribbons-bookcase"
                    tabIndex={bookcase.id === open.id ? 0 : -1}
                    onKeyDown={(event) => move(event, index)}
                    onClick={() => onOpen(bookcase)}
                >
                    <b>{bookcase.name}</b>
                    <small>
                        {counts.shelves(bookcase.shelves.length)} ·{' '}
                        {counts.books(bookcase.bookCount)}
                    </small>
                </button>
            ))}
        </div>
    );
}

export function RibbonsView({
    bookcases,
    bookcase,
    editor,
    onSelect,
    onEdit,
}: BookshelvesViewProps) {
    const { t } = useI18n();
    const counts = useLocationCounts();

    return (
        <div className="ribbons">
            <BookcaseTabs
                bookcases={bookcases}
                open={bookcase}
                onOpen={(chosen) => onSelect({ bookcase: chosen.id, keepShelf: true })}
            />
            <section
                id="ribbons-bookcase"
                className="ribbons__bookcase"
                role="tabpanel"
                aria-labelledby={tabId(bookcase)}
            >
                <div className="ribbons__header">
                    <h2 className="panel__title">{bookcase.name}</h2>
                    <span className="muted">
                        {t('ribbons.order', { shelves: counts.shelves(bookcase.shelves.length) })}
                    </span>
                    {editor && (
                        <BookcaseActions
                            bookcase={bookcase}
                            className="ribbons__actions"
                            onEdit={onEdit}
                        />
                    )}
                </div>
                {bookcase.shelves.length === 0 ? (
                    <p className="muted">
                        {editor ? t('bookshelves.noShelf') : t('bookshelves.noShelfGuest')}
                    </p>
                ) : (
                    bookcase.shelves.map((shelf) => (
                        <RibbonShelf key={shelf.id} shelf={shelf} editor={editor} onEdit={onEdit} />
                    ))
                )}
            </section>
        </div>
    );
}
