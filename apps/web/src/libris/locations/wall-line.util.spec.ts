import { describe, expect, it } from 'vitest';
import type { BookcaseDto, BookcaseSize } from '../../../../../packages/contracts/src/http';
import { WallLine } from './wall-line.util';

function bookcase(id: string, size: BookcaseSize, shelves = 5): BookcaseDto {
    return {
        id,
        name: id,
        size,
        bookCount: 0,
        shelves: Array.from({ length: shelves }, (_, index) => ({
            id: id + '-' + index,
            bookcaseId: id,
            name: 'Shelf ' + index,
            bookCount: 0,
        })),
    };
}

const four = [
    bookcase('a', 'large'),
    bookcase('b', 'small'),
    bookcase('c', 'small', 7),
    bookcase('d', 'large', 7),
];

describe('WallLine.scale', () => {
    it('draws at full size when the room is unknown', () => {
        const result = WallLine.scale(null, 7);

        expect(result).toBe(1);
    });
    it('shrinks the drawing so the tallest bookcase fits the room', () => {
        const result = WallLine.scale(110 + 297, 7);

        expect(result).toBe(0.5);
    });
    it('never draws larger than full size', () => {
        const result = WallLine.scale(2000, 5);

        expect(result).toBe(1);
    });
    it('stops shrinking at half size', () => {
        const result = WallLine.scale(200, 7);

        expect(result).toBe(0.5);
    });
});

describe('WallLine layout', () => {
    it('gives each bookcase the width of its drawing at the scale, with its padding', () => {
        const layout = new WallLine(four, 0.5, null);

        const result = [layout.width(0), layout.width(1)];

        expect(result).toEqual([310, 205]);
    });
    it('puts each bookcase after the previous one and a gap', () => {
        const layout = new WallLine(four, 1, 1000);

        const result = [layout.offset(0), layout.offset(1), layout.offset(2)];

        expect(result).toEqual([0, 594, 978]);
    });
    it('does not overflow when every bookcase fits the room', () => {
        const layout = new WallLine(four, 0.5, 2000);

        const result = [layout.overflows(), layout.lastStart()];

        expect(result).toEqual([false, 0]);
    });
    it('stops moving once the last bookcase is in view', () => {
        const layout = new WallLine(four, 1, 1200);

        const result = layout.lastStart();

        expect(result).toBe(2);
    });
    it('counts a bookcase cut at the edge as shown but not fully shown', () => {
        const layout = new WallLine(four, 1, 1200);

        const result = [layout.shown(2, 0), layout.fullyShown(2, 0)];

        expect(result).toEqual([true, false]);
    });
    it('does not show a bookcase past the edge', () => {
        const layout = new WallLine(four, 1, 1200);

        const result = layout.shown(3, 0);

        expect(result).toBe(false);
    });
});

describe('WallLine.columns', () => {
    it('fits as many covers as the width allows', () => {
        const result = WallLine.columns(1648);

        expect(result).toBe(25);
    });
    it('keeps at least three covers', () => {
        const result = WallLine.columns(100);

        expect(result).toBe(3);
    });
});

it('keeps room for the tallest bookcase at half size', () => {
    const result = WallLine.minimumHeight(four);

    expect(result).toBe(407);
});
