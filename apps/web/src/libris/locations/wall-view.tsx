import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import type { BookshelvesViewProps } from './bookshelves-view';
import { IconAction } from './icon-action';
import { ShelfPanel } from './shelf-panel';
import { useBookcaseSpines } from './use-bookcase-spines';
import { useElementWidth } from './use-element-width';
import { useLocationCounts } from './use-location-counts';
import { WallDrawing } from './wall-drawing.util';
import { WallShelf } from './wall-shelf';
import { WallSizes } from './wall-sizes';

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
                    <span
                        className={
                            bookcase.size === 'small'
                                ? 'wall-miniature wall-miniature--small'
                                : 'wall-miniature'
                        }
                        aria-hidden="true"
                    >
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
    const scale = width === null ? 1 : Math.min(1, width / WallDrawing.width(bookcase.size));
    const books = new Map(spines?.shelves.map((entry) => [entry.shelfId, entry.books]));

    return (
        <section
            className="panel wall-bookcase"
            aria-labelledby="wall-bookcase-name"
            style={WallDrawing.styles(bookcase.size)}
        >
            <div className="wall-bookcase__header">
                <div className="wall-bookcase__title">
                    <h2 id="wall-bookcase-name" className="panel__title">
                        {bookcase.name}
                    </h2>
                    {editor && (
                        <>
                            <IconAction
                                icon="edit"
                                label={t('bookcase.edit')}
                                onClick={() => onEdit({ kind: 'edit-bookcase', bookcase })}
                            />
                            <span className="wall-bookcase__end">
                                <IconAction
                                    icon="add"
                                    label={t('shelf.add')}
                                    onClick={() => onEdit({ kind: 'create-shelf', bookcase })}
                                />
                                <IconAction
                                    icon="delete"
                                    label={t('bookcase.delete')}
                                    danger
                                    onClick={() => onEdit({ kind: 'delete-bookcase', bookcase })}
                                />
                            </span>
                        </>
                    )}
                </div>
                <span className="muted">
                    {counts.shelves(bookcase.shelves.length)} · {counts.books(bookcase.bookCount)}
                </span>
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
                                bayWidth={WallSizes.bayWidths[bookcase.size]}
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
