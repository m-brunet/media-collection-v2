import { describe, expect, it } from 'vitest';
import type { CoverPixels } from './cover-padding.service.js';
import { CoverPadding } from './cover-padding.service.js';

type Colour = readonly [number, number, number];

const white: Colour = [255, 255, 255];
const ink: Colour = [40, 60, 120];

function image(
    width: number,
    height: number,
    paint: (x: number, y: number) => Colour,
    channels = 3,
): CoverPixels {
    const data = new Uint8Array(width * height * channels);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const start = (y * width + x) * channels;

            data.set(paint(x, y), start);

            if (channels === 4) {
                data[start + 3] = 255;
            }
        }
    }

    return { width, height, channels, data };
}

function padded(
    width: number,
    height: number,
    box: { left: number; top: number; right: number; bottom: number },
    channels = 3,
) {
    return image(
        width,
        height,
        (x, y) =>
            x >= box.left && x <= box.right && y >= box.top && y <= box.bottom ? ink : white,
        channels,
    );
}

describe('CoverPadding', () => {
    it('keeps the cover between two equal white bars of a shop square', () => {
        const pixels = padded(100, 100, { left: 17, top: 0, right: 82, bottom: 99 });

        const box = CoverPadding.measure(pixels);

        expect(box).toEqual({ left: 17, top: 0, width: 66, height: 100 });
    });

    it('removes bars above and below a cover', () => {
        const pixels = padded(60, 100, { left: 0, top: 10, right: 59, bottom: 89 });

        const box = CoverPadding.measure(pixels);

        expect(box).toEqual({ left: 0, top: 10, width: 60, height: 80 });
    });

    it('reads images with an alpha channel', () => {
        const pixels = padded(100, 100, { left: 20, top: 0, right: 79, bottom: 99 }, 4);

        const box = CoverPadding.measure(pixels);

        expect(box).toEqual({ left: 20, top: 0, width: 60, height: 100 });
    });

    it('tolerates the slight noise of a compressed white', () => {
        const pixels = image(100, 100, (x, y) => {
            if (x >= 15 && x <= 84) {
                return ink;
            }

            return x === 3 && y === 50 ? ink : [250 - ((x + y) % 10), 252, 247];
        });

        const box = CoverPadding.measure(pixels);

        expect(box).toEqual({ left: 15, top: 0, width: 70, height: 100 });
    });

    it('finds nothing to remove on a cover without padding', () => {
        const pixels = image(60, 90, () => ink);

        const box = CoverPadding.measure(pixels);

        expect(box).toBeNull();
    });

    it('keeps a cover whose own artwork is white along one edge', () => {
        const pixels = padded(62, 100, { left: 0, top: 10, right: 61, bottom: 99 });

        const box = CoverPadding.measure(pixels);

        expect(box).toBeNull();
    });

    it('keeps a cover that is white on more than one pair of sides', () => {
        const pixels = padded(100, 150, { left: 20, top: 0, right: 92, bottom: 119 });

        const box = CoverPadding.measure(pixels);

        expect(box).toBeNull();
    });

    it('keeps a cover between bars of clearly different widths', () => {
        const pixels = padded(100, 100, { left: 30, top: 0, right: 94, bottom: 99 });

        const box = CoverPadding.measure(pixels);

        expect(box).toBeNull();
    });

    it('ignores bars too thin to be shop padding', () => {
        const pixels = padded(100, 150, { left: 1, top: 0, right: 98, bottom: 149 });

        const box = CoverPadding.measure(pixels);

        expect(box).toBeNull();
    });

    it('does not count grey padding as white', () => {
        const pixels = image(100, 100, (x) => (x >= 17 && x <= 82 ? ink : [220, 220, 220]));

        const box = CoverPadding.measure(pixels);

        expect(box).toBeNull();
    });
});
