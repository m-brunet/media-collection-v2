export interface CoverPixels {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array;
}

export interface CropBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

export class CoverPadding {
    // Every colour channel at least this bright counts as white (JPEG noise is never pure white).
    static readonly whiteness = 235;
    static readonly whiteShare = 0.99;
    static readonly minimumBar = 0.02;
    static readonly barToleranceInPixels = 2;
    static readonly barToleranceShare = 0.1;
    static readonly strayLines = 1;

    static measure(pixels: CoverPixels): CropBox | null {
        const { width, height } = pixels;
        let top = 0;
        let bottom = height - 1;
        let left = 0;
        let right = width - 1;

        while (top < bottom && CoverPadding.whiteRow(pixels, top)) {
            top++;
        }

        while (bottom > top && CoverPadding.whiteRow(pixels, bottom)) {
            bottom--;
        }

        while (left < right && CoverPadding.whiteColumn(pixels, left, top, bottom)) {
            left++;
        }

        while (right > left && CoverPadding.whiteColumn(pixels, right, top, bottom)) {
            right--;
        }

        const bars = { left, right: width - 1 - right, top, bottom: height - 1 - bottom };
        const sides =
            CoverPadding.pair(bars.left, bars.right, width) &&
            bars.top <= CoverPadding.strayLines &&
            bars.bottom <= CoverPadding.strayLines;
        const ends =
            CoverPadding.pair(bars.top, bars.bottom, height) &&
            bars.left <= CoverPadding.strayLines &&
            bars.right <= CoverPadding.strayLines;

        if (!sides && !ends) {
            return null;
        }

        return { left, top, width: right - left + 1, height: bottom - top + 1 };
    }

    private static pair(first: number, second: number, size: number): boolean {
        const tolerance = Math.max(
            CoverPadding.barToleranceInPixels,
            CoverPadding.barToleranceShare * Math.max(first, second),
        );

        return (
            Math.min(first, second) >= CoverPadding.minimumBar * size &&
            Math.abs(first - second) <= tolerance
        );
    }

    private static whiteRow(pixels: CoverPixels, y: number): boolean {
        let white = 0;

        for (let x = 0; x < pixels.width; x++) {
            if (CoverPadding.white(pixels, x, y)) {
                white++;
            }
        }

        return white >= CoverPadding.whiteShare * pixels.width;
    }

    private static whiteColumn(pixels: CoverPixels, x: number, top: number, bottom: number) {
        let white = 0;

        for (let y = top; y <= bottom; y++) {
            if (CoverPadding.white(pixels, x, y)) {
                white++;
            }
        }

        return white >= CoverPadding.whiteShare * (bottom - top + 1);
    }

    private static white(pixels: CoverPixels, x: number, y: number): boolean {
        const start = (y * pixels.width + x) * pixels.channels;

        for (let channel = 0; channel < 3; channel++) {
            if (pixels.data[start + channel]! < CoverPadding.whiteness) {
                return false;
            }
        }

        return true;
    }
}
