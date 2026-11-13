import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { CollectionMemberDto } from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';
import type { WallSlot } from './collection-covers.util';
import { CollectionCovers } from './collection-covers.util';

export interface WallTile {
    chosen: boolean;
    check?: boolean;
    pressed?: boolean;
    disabled?: boolean;
    dimmed?: boolean;
    sub?: string;
    badge?: { label: string; tone: 'accent' | 'muted' | 'warning' };
}

function TileCover({ book, tile }: { book: CollectionMemberDto; tile: WallTile }) {
    const source = book.hasCover ? BookFormat.cover(book.id, book.updatedAt) : null;
    const [failed, setFailed] = useState<string | null>(null);
    const style = { '--tile-hue': CollectionCovers.hue(book) } as CSSProperties;

    return (
        <span className="wall-tile__cover" style={style}>
            {source && failed !== source ? (
                <img
                    className="wall-tile__image"
                    src={source}
                    alt=""
                    onError={() => setFailed(source)}
                />
            ) : (
                <span className="wall-tile__volume" aria-hidden="true">
                    {CollectionCovers.volumes(book)}
                </span>
            )}
            {tile.check && (
                <span className="wall-tile__check" aria-hidden="true">
                    {tile.chosen && <Icon name="check" size={14} />}
                </span>
            )}
            {tile.badge && (
                <span className={'wall-tile__badge wall-tile__badge--' + tile.badge.tone}>
                    {tile.badge.label}
                </span>
            )}
        </span>
    );
}

function BookTile({
    book,
    tile,
    link,
    onClick,
}: {
    book: CollectionMemberDto;
    tile: WallTile;
    link?: string;
    onClick?(): void;
}) {
    const { t } = useI18n();
    const sub =
        tile.sub ??
        [
            t(BookFormat.ownership(book.ownership)),
            book.volumeFrom !== book.volumeTo
                ? t('collection.tile.omnibus', { from: book.volumeFrom, to: book.volumeTo })
                : null,
            book.category === 'books' ? t(BookFormat.category(book.category)) : null,
        ]
            .filter(Boolean)
            .join(' · ');
    const name = [book.title, sub, tile.badge?.label].filter(Boolean).join(', ');
    const className = [
        'wall-tile',
        tile.chosen ? 'wall-tile--chosen' : null,
        tile.dimmed ? 'wall-tile--dimmed' : null,
        onClick && tile.pressed && !tile.check ? 'wall-tile--focused' : null,
    ]
        .filter(Boolean)
        .join(' ');
    const content = (
        <>
            <TileCover book={book} tile={tile} />
            <span className="wall-tile__title">{book.title}</span>
            <span className="wall-tile__sub">{sub}</span>
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                className={className}
                aria-label={name}
                aria-pressed={tile.pressed ?? false}
                disabled={tile.disabled}
                onClick={onClick}
            >
                {content}
            </button>
        );
    }

    return link ? (
        <Link to={link} className={className} aria-label={name}>
            {content}
        </Link>
    ) : (
        <div className={className}>{content}</div>
    );
}

function MissingTile({ volume }: { volume: number }) {
    const { t } = useI18n();

    return (
        <div className="wall-tile wall-tile--missing">
            <span className="wall-tile__cover">
                <span className="wall-tile__volume" aria-hidden="true">
                    {volume}
                </span>
            </span>
            <span className="wall-tile__title">{t('volume.one', { number: volume })}</span>
            <span className="wall-tile__sub">{t('collection.tile.missing')}</span>
        </div>
    );
}

export function CollectionWall({
    slots,
    eyebrow,
    hint,
    action,
    tile = () => ({ chosen: false }),
    link,
    onClick,
}: {
    slots: WallSlot[];
    eyebrow: string;
    hint?: string;
    action?: ReactNode;
    tile?(book: CollectionMemberDto): WallTile;
    link?(book: CollectionMemberDto): string;
    onClick?(book: CollectionMemberDto): void;
}) {
    return (
        <section className="collection-wall" aria-label={eyebrow}>
            <div className="collection-wall__heading">
                <span className="eyebrow">{eyebrow}</span>
                {hint && <span className="muted">{hint}</span>}
                {action && <div className="collection-wall__action">{action}</div>}
            </div>
            <ul className="collection-wall__books">
                {slots.map((slot) =>
                    slot.kind === 'book' ? (
                        <li key={slot.book.id}>
                            <BookTile
                                book={slot.book}
                                tile={tile(slot.book)}
                                link={link?.(slot.book)}
                                onClick={onClick && (() => onClick(slot.book))}
                            />
                        </li>
                    ) : (
                        <li key={'missing-' + slot.volume}>
                            <MissingTile volume={slot.volume} />
                        </li>
                    ),
                )}
            </ul>
        </section>
    );
}
