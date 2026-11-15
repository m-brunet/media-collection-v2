import { describe, expect, it } from 'vitest';
import type { SpineBook } from './spine-layout.util';
import { SpineLayout } from './spine-layout.util';

function books(count: number, book: Omit<SpineBook, 'id'>, prefix = 'book'): SpineBook[] {
    return Array.from({ length: count }, (_, index) => ({ id: prefix + '-' + index, ...book }));
}

const novel = { category: 'books', pageCount: 450 } as const;
const unknownManga = { category: 'manga', pageCount: null } as const;

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
            570,
        );

        expect(result.spines.map((spine) => spine.width)).toEqual([10, 13, 7]);
    });
    it('places the books side by side from the left', () => {
        const result = SpineLayout.shelf(books(3, novel), 570);

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
    it('gives the same colour and height to the same book every time', () => {
        const first = SpineLayout.shelf(books(1, novel), 570).spines[0];

        const result = SpineLayout.shelf(books(1, novel), 570).spines[0];

        expect(result).toEqual(first);
    });
    it('keeps colours and heights within their ranges', () => {
        const result = SpineLayout.shelf(books(40, unknownManga), 570).spines;

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
