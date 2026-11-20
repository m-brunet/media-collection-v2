import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { BookcaseDto, ShelfDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import type { BookshelvesViewProps } from './bookshelves-view';
import type { LocationEditing } from './location-dialogs';
import { IconAction } from './icon-action';
import { ShelfCovers } from './shelf-panel';
import { ShelfPlacement } from './shelf-placement.util';
import { useAvailableHeight } from './use-available-height';
import { useBookcaseSpines } from './use-bookcase-spines';
import { useElementSize, useElementWidth } from './use-element-width';
import { useInView } from './use-in-view';
import { useLocationCounts } from './use-location-counts';
import { WallDrawing } from './wall-drawing.util';
import { WallLine } from './wall-line.util';
import { WallShelf } from './wall-shelf';
import { WallSizes } from './wall-sizes';

function LineBookcase({
    bookcase,
    scale,
    width,
    current,
    shelf,
    editor,
    onFocus,
    onSelect,
    onEdit,
}: {
    bookcase: BookcaseDto;
    scale: number;
    width: number;
    current: boolean;
    shelf: ShelfDto | null;
    editor: boolean;
    onFocus(): void;
    onSelect(shelfId: string): void;
    onEdit(editing: LocationEditing): void;
}) {
    const { t } = useI18n();
    const counts = useLocationCounts();
    const element = useRef<HTMLElement>(null);
    const seen = useInView(element);
    const { spines, failure } = useBookcaseSpines(bookcase, seen);
    const books = new Map(spines?.shelves.map((entry) => [entry.shelfId, entry.books]));
    const nameId = 'wall-line-' + bookcase.id;

    return (
        <section
            ref={element}
            className="panel wall-line__case"
            aria-labelledby={nameId}
            aria-current={current || undefined}
            style={{ ...WallDrawing.styles(bookcase.size), width }}
            onFocus={onFocus}
        >
            <div className="wall-line__head">
                <h2 id={nameId} className="wall-line__name">
                    {bookcase.name}
                </h2>
                {editor && (
                    <>
                        <IconAction
                            icon="edit"
                            label={t('bookcase.edit')}
                            onClick={() => onEdit({ kind: 'edit-bookcase', bookcase })}
                        />
                        <span className="wall-line__end">
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
            <p className="wall-line__counts">
                {counts.shelves(bookcase.shelves.length)} · {counts.books(bookcase.bookCount)}
            </p>
            {bookcase.shelves.length === 0 ? (
                <p className="muted">
                    {editor ? t('bookshelves.noShelf') : t('bookshelves.noShelfGuest')}
                </p>
            ) : failure ? (
                <Notice tone="error">{t(failure)}</Notice>
            ) : !spines ? (
                <div
                    className="wall-line__waiting"
                    style={{ height: WallDrawing.height(bookcase.shelves.length) * scale }}
                >
                    <LoadingState label={t('wall.loading')} />
                </div>
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
                            onSelect={() => onSelect(candidate.id)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function CoversRoom({ columns, children }: { columns: number; children?: ReactNode }) {
    const { t } = useI18n();

    return (
        <div className="wall-line__covers">
            <div className="wall-line__covers-room" aria-hidden="true">
                <ul
                    className="shelf-panel__covers"
                    style={{ gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))' }}
                >
                    <li className="wall-line__cover-room" />
                </ul>
                <span className="shelf-panel__link">
                    {t('wall.openInBooks')}
                    <Icon name="expand" />
                </span>
            </div>
            <div className="wall-line__covers-shown">{children}</div>
        </div>
    );
}

function LineShelfPanel({
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
    const columns = WallLine.columns(width);

    return (
        <aside ref={panel} className="panel wall-line__panel" aria-label={t('wall.panelLabel')}>
            {shelf ? (
                <>
                    <div className="wall-line__panel-head">
                        <h2 className="panel__title">
                            {shelf.bookCount === 1
                                ? t('shelf.headingOne', { name: shelf.name })
                                : t('shelf.headingMany', {
                                      name: shelf.name,
                                      count: shelf.bookCount,
                                  })}
                        </h2>
                        {editor && (
                            <IconAction
                                icon="edit"
                                label={t('shelf.renameTitle')}
                                onClick={() => onEdit({ kind: 'rename-shelf', shelf })}
                            />
                        )}
                        <p className="eyebrow">
                            {bookcase.name} / {shelf.name}
                        </p>
                        {editor && (
                            <span className="wall-line__end actions">
                                <Button
                                    icon="add"
                                    onClick={() => navigate(ShelfPlacement.opening(shelf.id))}
                                >
                                    {t('shelf.addBooks')}
                                </Button>
                                <Button
                                    icon="move"
                                    onClick={() => onEdit({ kind: 'move-shelf', shelf })}
                                >
                                    {t('shelf.move')}
                                </Button>
                                <IconAction
                                    icon="delete"
                                    label={t('shelf.delete')}
                                    danger
                                    onClick={() => onEdit({ kind: 'delete-shelf', shelf })}
                                />
                            </span>
                        )}
                    </div>
                    <CoversRoom columns={columns}>
                        <ShelfCovers shelf={shelf} columns={columns} rows={1} limit={columns} />
                    </CoversRoom>
                </>
            ) : (
                <>
                    <div className="wall-line__panel-head">
                        <p className="muted">
                            {editor ? t('bookshelves.noShelf') : t('bookshelves.noShelfGuest')}
                        </p>
                    </div>
                    <CoversRoom columns={columns} />
                </>
            )}
        </aside>
    );
}

export function WallLineView({
    bookcases,
    bookcase,
    shelf,
    editor,
    onSelect,
    onEdit,
}: BookshelvesViewProps) {
    const { t } = useI18n();
    const root = useRef<HTMLDivElement>(null);
    const line = useRef<HTMLDivElement>(null);
    const available = useAvailableHeight(root, WallSizes.lineBottomGap);
    const room = useElementSize(line);
    const scale = WallLine.scale(
        room?.height ?? null,
        Math.max(...bookcases.map((candidate) => candidate.shelves.length)),
    );
    const layout = new WallLine(bookcases, scale, room?.width ?? null);
    const [start, setStart] = useState(0);
    const first = Math.min(start, layout.lastStart());
    const index = bookcases.findIndex((candidate) => candidate.id === bookcase.id);
    const [revealed, setRevealed] = useState<number | null>(null);
    const reveal = (target: number) => {
        if (!layout.fullyShown(target, first)) {
            setStart(Math.min(target, layout.lastStart()));
        }
    };

    if (room !== null && revealed !== index) {
        setRevealed(index);
        reveal(index);
    }

    return (
        <div
            ref={root}
            className="wall-line"
            style={available === null ? undefined : { height: Math.max(available, 0) }}
        >
            <nav className="wall-line__goto" aria-label={t('wall.goToLabel')}>
                <span className="eyebrow">{t('wall.goTo')}</span>
                {bookcases.map((candidate, position) => (
                    <button
                        key={candidate.id}
                        type="button"
                        className={
                            layout.shown(position, first)
                                ? 'wall-line__jump wall-line__jump--shown'
                                : 'wall-line__jump'
                        }
                        aria-current={candidate.id === bookcase.id || undefined}
                        onClick={() => setStart(Math.min(position, layout.lastStart()))}
                    >
                        {candidate.name}
                    </button>
                ))}
            </nav>
            <div
                ref={line}
                role="region"
                aria-label={t('wall.bookcases')}
                className="wall-line__room"
                style={{ minHeight: WallLine.minimumHeight(bookcases) }}
            >
                {layout.overflows() && (
                    <>
                        <button
                            type="button"
                            className="wall-line__arrow wall-line__arrow--previous"
                            aria-label={t('wall.previous')}
                            disabled={first === 0}
                            onClick={() => setStart(first - 1)}
                        >
                            <Icon name="previous" size={20} />
                        </button>
                        <button
                            type="button"
                            className="wall-line__arrow wall-line__arrow--next"
                            aria-label={t('wall.next')}
                            disabled={first >= layout.lastStart()}
                            onClick={() => setStart(first + 1)}
                        >
                            <Icon name="next" size={20} />
                        </button>
                    </>
                )}
                <div
                    className="wall-line__track"
                    style={{ transform: 'translateX(' + -layout.offset(first) + 'px)' }}
                >
                    {bookcases.map((candidate, position) => (
                        <LineBookcase
                            key={candidate.id}
                            bookcase={candidate}
                            scale={scale}
                            width={layout.width(position)}
                            current={candidate.id === bookcase.id}
                            shelf={shelf}
                            editor={editor}
                            onFocus={() => reveal(position)}
                            onSelect={(shelfId) => onSelect({ shelf: shelfId })}
                            onEdit={onEdit}
                        />
                    ))}
                </div>
            </div>
            <LineShelfPanel bookcase={bookcase} shelf={shelf} editor={editor} onEdit={onEdit} />
        </div>
    );
}
