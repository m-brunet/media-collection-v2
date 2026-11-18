import { expect, it } from 'vitest';
import { WallDrawing } from './wall-drawing.util';

it('adds the shelf names, the gap and the borders to the width of the books', () => {
    const result = [WallDrawing.width('large'), WallDrawing.width('small')];

    expect(result).toEqual([536, 326]);
});

it('stacks the bays and the top board for the height', () => {
    const result = WallDrawing.height(7);

    expect(result).toBe(594);
});

it('gives a bookcase without shelves the height of one bay', () => {
    const result = WallDrawing.height(0);

    expect(result).toBe(90);
});

it('passes the bay width of the size to the styles', () => {
    const result = WallDrawing.styles('small');

    expect(result).toMatchObject({ '--wall-bay-width': '210px', '--wall-drawing-width': '326px' });
});
