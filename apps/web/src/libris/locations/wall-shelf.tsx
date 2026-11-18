import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Link } from 'react-router';
import type { ShelfDto, SpineBookDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { SpineLayout } from './spine-layout.util';
import { useLocationCounts } from './use-location-counts';

const moves: Partial<Record<string, (index: number, last: number) => number>> = {
    ArrowRight: (index, last) => Math.min(last, index + 1),
    ArrowDown: (index, last) => Math.min(last, index + 1),
    ArrowLeft: (index) => Math.max(0, index - 1),
    ArrowUp: (index) => Math.max(0, index - 1),
    Home: () => 0,
    End: (_, last) => last,
};

export function WallShelf({
    shelf,
    books,
    bayWidth,
    current,
    onSelect,
}: {
    shelf: ShelfDto;
    books: readonly SpineBookDto[];
    bayWidth: number;
    current: boolean;
    onSelect(): void;
}) {
    const { t } = useI18n();
    const counts = useLocationCounts();
    const [active, setActive] = useState(0);
    const [pointed, setPointed] = useState<{ label: string; x: number } | null>(null);
    const links = useRef<(HTMLAnchorElement | null)[]>([]);
    const drawing = SpineLayout.shelf(books, bayWidth);
    const named = new Map(books.map((book) => [book.id, book]));
    const focused = Math.min(active, Math.max(0, drawing.spines.length - 1));
    const move = (event: KeyboardEvent, index: number) => {
        const next = moves[event.key]?.(index, drawing.spines.length - 1);

        if (next === undefined) {
            return;
        }

        event.preventDefault();
        setActive(next);
        links.current[next]?.focus();
    };

    return (
        <div className="wall-shelf" aria-current={current || undefined}>
            <button
                type="button"
                className="wall-shelf__name"
                aria-current={current || undefined}
                aria-label={t('shelf.row', {
                    name: shelf.name,
                    books: counts.books(shelf.bookCount),
                })}
                onClick={onSelect}
            >
                <b>{shelf.name}</b>
                <small>{counts.books(shelf.bookCount)}</small>
            </button>
            <div className="wall-shelf__bay" onClick={onSelect}>
                <ul
                    className="wall-shelf__spines"
                    aria-label={t('shelf.booksLabel', { name: shelf.name })}
                >
                    {drawing.spines.map((spine, index) => {
                        const book = named.get(spine.id);
                        const label = book
                            ? [
                                  book.title,
                                  ...(book.authors.length > 0 ? [book.authors.join(', ')] : []),
                              ].join(' · ')
                            : '';

                        return (
                            <li key={spine.id}>
                                <Link
                                    ref={(link) => {
                                        links.current[index] = link;
                                    }}
                                    to={'/books/' + spine.id}
                                    className={
                                        spine.behind
                                            ? 'wall-spine wall-spine--behind'
                                            : 'wall-spine'
                                    }
                                    aria-label={label}
                                    tabIndex={index === focused ? 0 : -1}
                                    style={
                                        {
                                            left: spine.x,
                                            width: spine.width,
                                            height: spine.height,
                                            '--spine-colour':
                                                'var(--color-spine-' + (spine.colour + 1) + ')',
                                        } as CSSProperties
                                    }
                                    onKeyDown={(event) => move(event, index)}
                                    onFocus={() => {
                                        setActive(index);
                                        setPointed({ label, x: spine.x + spine.width / 2 });
                                    }}
                                    onBlur={() => setPointed(null)}
                                    onMouseEnter={() =>
                                        setPointed({ label, x: spine.x + spine.width / 2 })
                                    }
                                    onMouseLeave={() => setPointed(null)}
                                />
                            </li>
                        );
                    })}
                </ul>
                {pointed && (
                    <span
                        className="wall-shelf__tip"
                        aria-hidden="true"
                        style={{ left: pointed.x }}
                    >
                        {pointed.label}
                    </span>
                )}
            </div>
        </div>
    );
}
