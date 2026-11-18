import { describe, expect, it } from 'vitest';
import type { SpineBook } from './spine-layout.util';
import { SpineLayout } from './spine-layout.util';

function books(count: number, book: Omit<SpineBook, 'id'>, prefix = 'book'): SpineBook[] {
    return Array.from({ length: count }, (_, index) => ({ id: prefix + '-' + index, ...book }));
}

const novel = { category: 'books', pageCount: 450 } as const;
const unknownManga = { category: 'manga', pageCount: null } as const;
const short = { category: 'books', pageCount: 200 } as const;

describe('SpineLayout.width', () => {
    it('gives the thinnest width to a very short book', () => {
        const result = SpineLayout.width(20);

        expect(result).toBe(6);
    });
    it('grows with the page count', () => {
        const result = [SpineLayout.width(200), SpineLayout.width(450)];

        expect(result).toEqual([10, 14]);
    });
    it('stops growing at 900 pages', () => {
        const result = [SpineLayout.width(900), SpineLayout.width(2000)];

        expect(result).toEqual([22, 22]);
    });
});

describe('SpineLayout.shelf', () => {
    it('draws a book without a page count as an average book of its category', () => {
        const result = SpineLayout.shelf(
            [
                { id: 'manga', category: 'manga', pageCount: null },
                { id: 'novel', category: 'books', pageCount: null },
                { id: 'comic', category: 'comics', pageCount: null },
            ],
            420,
        );

        expect(result.spines.map((spine) => spine.width)).toEqual([10, 13, 7]);
    });
    it('places the books side by side from the left', () => {
        const result = SpineLayout.shelf(books(3, novel), 420);

        expect(result.spines.map((spine) => [spine.x, spine.behind])).toEqual([
            [0, false],
            [14, false],
            [28, false],
        ]);
    });
    it('shrinks the books without a page count equally to fit the front', () => {
        const result = SpineLayout.shelf(
            [...books(2, { category: 'books', pageCount: null }), ...books(1, unknownManga, 'm')],
            30,
        );

        expect(result.spines.map((spine) => [spine.width, spine.behind])).toEqual([
            [11, false],
            [11, false],
            [8, false],
        ]);
    });
    it('keeps the width of the books with a page count while the others shrink', () => {
        const result = SpineLayout.shelf([...books(1, novel), ...books(2, unknownManga, 'm')], 30);

        expect(result.spines.map((spine) => spine.width)).toEqual([14, 8, 8]);
    });
    it('never shrinks a book under the thinnest width', () => {
        const result = SpineLayout.shelf(books(10, unknownManga), 30);

        expect(new Set(result.spines.map((spine) => spine.width))).toEqual(new Set([6]));
    });
    it('puts the books that still do not fit behind the front ones', () => {
        const result = SpineLayout.shelf(books(5, novel), 50);

        expect(result.spines.map((spine) => [spine.x, spine.behind])).toEqual([
            [0, false],
            [14, false],
            [28, false],
            [0, true],
            [14, true],
        ]);
    });
    it('draws nothing beyond two layers and counts the books left out', () => {
        const result = SpineLayout.shelf(books(10, novel), 30);

        expect([result.spines.length, result.hidden]).toEqual([4, 6]);
    });
    it('keeps 400 px of spines on one row of a Large shelf', () => {
        const result = SpineLayout.shelf(books(40, short), 420);

        expect(result.spines.filter((spine) => spine.behind)).toEqual([]);
        expect(result.hidden).toBe(0);
    });
    it('puts 400 px of spines on two rows of a Small shelf', () => {
        const result = SpineLayout.shelf(books(40, short), 210);

        expect(result.spines.filter((spine) => spine.behind)).toHaveLength(19);
        expect(result.hidden).toBe(0);
    });
    it('leaves out the books past two rows of a Small shelf', () => {
        const result = SpineLayout.shelf(books(50, short), 210);

        expect(result.spines).toHaveLength(42);
        expect(result.hidden).toBe(8);
    });
    it('gives the same colour and height to the same book every time', () => {
        const first = SpineLayout.shelf(books(1, novel), 420).spines[0];

        const result = SpineLayout.shelf(books(1, novel), 420).spines[0];

        expect(result).toEqual(first);
    });
    it('lowers the front row of a shelf that has a back row to 42 to 58 px', () => {
        const result = SpineLayout.shelf(books(40, short), 210).spines;

        const heights = result.filter((spine) => !spine.behind).map((spine) => spine.height);

        expect(Math.min(...heights)).toBeGreaterThanOrEqual(42);
        expect(Math.max(...heights)).toBeLessThanOrEqual(58);
    });
    it('raises each back spine 10 to 18 px above the tallest front spine it stands behind', () => {
        const result = SpineLayout.shelf(books(40, short), 210).spines;

        const front = result.filter((spine) => !spine.behind);
        const rises = result
            .filter((spine) => spine.behind)
            .map((spine) => {
                const left = spine.x + 3;
                const tallest = Math.max(
                    ...front
                        .filter(
                            (other) => other.x < left + spine.width && other.x + other.width > left,
                        )
                        .map((other) => other.height),
                );

                return spine.height + 4 - tallest;
            });

        expect(Math.min(...rises)).toBeGreaterThanOrEqual(10);
        expect(Math.max(...rises)).toBeLessThanOrEqual(18);
    });
    it('keeps every back spine 4 px under the board of the shelf above', () => {
        const result = SpineLayout.shelf(books(80, short), 420).spines;

        const tops = result.filter((spine) => spine.behind).map((spine) => spine.height + 4);

        expect(Math.max(...tops)).toBeLessThanOrEqual(74);
    });
    it('lists the front spines first, then the back ones', () => {
        const result = SpineLayout.shelf(books(5, novel), 50).spines;

        const layers = result.map((spine) => spine.behind);

        expect(layers).toEqual([false, false, false, true, true]);
    });
    it('keeps colours and heights within their ranges', () => {
        const result = SpineLayout.shelf(books(40, unknownManga), 420).spines;

        expect(
            result.every(
                (spine) =>
                    spine.colour >= 0 &&
                    spine.colour < 8 &&
                    spine.height >= 50 &&
                    spine.height <= 68,
            ),
        ).toBe(true);
    });
});
