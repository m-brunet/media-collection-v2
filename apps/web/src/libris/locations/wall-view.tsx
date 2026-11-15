import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { BookcaseActions } from './bookcase-actions';
import type { BookshelvesViewProps } from './bookshelves-view';
import { ShelfPanel } from './shelf-panel';
import { useBookcaseSpines } from './use-bookcase-spines';
import { useElementWidth } from './use-element-width';
import { useLocationCounts } from './use-location-counts';
import { WallShelf } from './wall-shelf';
import { WallSizes } from './wall-sizes';

const drawingWidth =
    WallSizes.shelfNameWidth + WallSizes.shelfGap + WallSizes.bayWidth + 2 * WallSizes.bayBorder;
const sizes = {
    '--wall-bay-width': WallSizes.bayWidth + 'px',
    '--wall-bay-height': WallSizes.bayHeight + 'px',
    '--wall-bay-border': WallSizes.bayBorder + 'px',
    '--wall-name-width': WallSizes.shelfNameWidth + 'px',
    '--wall-shelf-gap': WallSizes.shelfGap + 'px',
    '--wall-drawing-width': drawingWidth + 'px',
} as CSSProperties;

function BookcaseStrip({
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
    const fullest = Math.max(
        1,
        ...bookcases.flatMap((bookcase) => bookcase.shelves.map((shelf) => shelf.bookCount)),
    );

    return (
        <nav className="wall-strip" aria-label={t('wall.bookcases')}>
            {bookcases.map((bookcase) => (
                <button
                    key={bookcase.id}
                    type="button"
                    className="wall-strip__case"
                    aria-current={bookcase.id === open.id || undefined}
                    onClick={() => onOpen(bookcase)}
                >
                    <span className="wall-miniature" aria-hidden="true">
                        {bookcase.shelves.map((shelf) => (
                            <i
                                key={shelf.id}
                                style={{ '--fill': shelf.bookCount / fullest } as CSSProperties}
                            />
                        ))}
                    </span>
                    <b>{bookcase.name}</b>
                    <small>
                        {counts.shelves(bookcase.shelves.length)} ·{' '}
                        {counts.books(bookcase.bookCount)}
                    </small>
                </button>
            ))}
        </nav>
    );
}

function OpenBookcase({
    bookcase,
    shelf,
    editor,
    onSelect,
    onEdit,
}: Omit<BookshelvesViewProps, 'bookcases'>) {
    const { t } = useI18n();
    const counts = useLocationCounts();
    const { spines, failure } = useBookcaseSpines(bookcase);
    const frame = useRef<HTMLDivElement>(null);
    const width = useElementWidth(frame);
    const scale = width === null ? 1 : Math.min(1, width / drawingWidth);
    const books = new Map(spines?.shelves.map((entry) => [entry.shelfId, entry.books]));

    return (
        <section className="panel wall-bookcase" aria-labelledby="wall-bookcase-name" style={sizes}>
            <div className="wall-bookcase__header">
                <h2 id="wall-bookcase-name" className="panel__title">
                    {bookcase.name}
                </h2>
                <span className="muted">
                    {counts.shelves(bookcase.shelves.length)} · {counts.books(bookcase.bookCount)}
                </span>
                {editor && (
                    <BookcaseActions
                        bookcase={bookcase}
                        className="wall-bookcase__actions"
                        onEdit={onEdit}
                    />
                )}
            </div>
            <div ref={frame} className="wall-bookcase__frame">
                {bookcase.shelves.length === 0 ? (
                    <p className="muted">
                        {editor ? t('bookshelves.noShelf') : t('bookshelves.noShelfGuest')}
                    </p>
                ) : failure ? (
                    <Notice tone="error">{t(failure)}</Notice>
                ) : !spines ? (
                    <LoadingState label={t('wall.loading')} />
                ) : (
                    <div
                        className="wall-bookcase__drawing"
                        style={scale === 1 ? undefined : { zoom: scale }}
                    >
                        {bookcase.shelves.map((candidate) => (
                            <WallShelf
                                key={candidate.id}
                                shelf={candidate}
                                books={books.get(candidate.id) ?? []}
                                current={candidate.id === shelf?.id}
                                onSelect={() => onSelect({ shelf: candidate.id })}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

export function WallView({ bookcases, ...open }: BookshelvesViewProps) {
    return (
        <div className="wall">
            <BookcaseStrip
                bookcases={bookcases}
                open={open.bookcase}
                onOpen={(bookcase) => open.onSelect({ bookcase: bookcase.id })}
            />
            <div className="wall__body">
                <OpenBookcase {...open} />
                <ShelfPanel
                    bookcase={open.bookcase}
                    shelf={open.shelf}
                    editor={open.editor}
                    onEdit={open.onEdit}
                />
            </div>
        </div>
    );
}
