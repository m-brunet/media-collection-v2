import type { BookCategory } from '../../../../../packages/contracts/src/http';
import { WallSizes } from './wall-sizes';

export interface SpineBook {
    id: string;
    category: BookCategory;
    pageCount: number | null;
}

export interface PlacedSpine {
    id: string;
    x: number;
    width: number;
    height: number;
    colour: number;
    behind: boolean;
}

export interface ShelfDrawing {
    spines: PlacedSpine[];
    hidden: number;
}

interface Sized {
    book: SpineBook;
    width: number;
    estimated: boolean;
}

export class SpineLayout {
    static width(pageCount: number): number {
        const share = Math.min(1, Math.max(0, pageCount / WallSizes.pagesAtMaxWidth));

        return Math.round(
            WallSizes.spineMinWidth + share * (WallSizes.spineMaxWidth - WallSizes.spineMinWidth),
        );
    }

    static height(id: string): number {
        const range = WallSizes.spineMaxHeight - WallSizes.spineMinHeight;

        return WallSizes.spineMinHeight + (SpineLayout.hash(id + ':height') % (range + 1));
    }

    static colour(id: string): number {
        return SpineLayout.hash(id) % WallSizes.spineColours;
    }

    static shelf(books: readonly SpineBook[], shelfWidth: number): ShelfDrawing {
        const sized = SpineLayout.fitted(
            books.map((book) => ({
                book,
                width: SpineLayout.width(book.pageCount ?? WallSizes.averagePages[book.category]),
                estimated: book.pageCount === null,
            })),
            shelfWidth,
        );
        const spines: PlacedSpine[] = [];
        let behind = false;
        let x = 0;

        for (const { book, width } of sized) {
            if (x + width > shelfWidth) {
                if (behind) {
                    break;
                }

                behind = true;
                x = 0;
            }

            spines.push({
                id: book.id,
                x,
                width,
                height: SpineLayout.height(book.id),
                colour: SpineLayout.colour(book.id),
                behind,
            });
            x += width;
        }

        return { spines, hidden: books.length - spines.length };
    }

    private static fitted(sized: Sized[], shelfWidth: number): Sized[] {
        const total = sized.reduce((sum, entry) => sum + entry.width, 0);
        const estimated = sized.filter((entry) => entry.estimated);

        if (total <= shelfWidth || estimated.length === 0) {
            return sized;
        }

        const cut = SpineLayout.equalCut(
            estimated.map((entry) => entry.width - WallSizes.spineMinWidth),
            total - shelfWidth,
        );

        return sized.map((entry) =>
            entry.estimated
                ? {
                      ...entry,
                      width: Math.max(WallSizes.spineMinWidth, Math.floor(entry.width - cut)),
                  }
                : entry,
        );
    }

    private static equalCut(room: number[], excess: number): number {
        const sorted = [...room].sort((a, b) => a - b);
        let left = excess;

        for (const [index, space] of sorted.entries()) {
            const sharing = sorted.length - index;
            const previous = index === 0 ? 0 : (sorted[index - 1] ?? 0);

            if ((space - previous) * sharing >= left) {
                return previous + left / sharing;
            }

            left -= (space - previous) * sharing;
        }

        return sorted.at(-1) ?? 0;
    }

    private static hash(value: string): number {
        let hash = 2166136261;

        for (const character of value) {
            hash ^= character.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }

        return hash >>> 0;
    }
}
