import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CoverImage } from '../../../../domain/value-objects/cover-image.value-object.js';
import { SharpCoverTrimmer } from './sharp-cover-trimmer.adapter.js';

type Format = 'jpeg' | 'png' | 'webp';

async function cover(format: Format, canvas: { width: number; height: number }, inner = canvas) {
    const art = await sharp({
        create: { ...inner, channels: 3, background: { r: 40, g: 60, b: 120 } },
    })
        .png()
        .toBuffer();
    const bytes = await sharp({
        create: { ...canvas, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
        .composite([
            {
                input: art,
                left: (canvas.width - inner.width) / 2,
                top: (canvas.height - inner.height) / 2,
            },
        ])
        .toFormat(format)
        .toBuffer();

    return CoverImage.from(new Uint8Array(bytes));
}

async function size(image: CoverImage) {
    const { width, height } = await sharp(image.bytes).metadata();

    return { width, height };
}

describe('SharpCoverTrimmer', () => {
    it('removes the white bars of a JPEG shop thumbnail', async () => {
        const thumbnail = await cover(
            'jpeg',
            { width: 340, height: 340 },
            { width: 226, height: 340 },
        );

        const trimmed = await new SharpCoverTrimmer().trim(thumbnail);

        expect(trimmed.mediaType).toBe('image/jpeg');
        expect(await size(trimmed)).toEqual({ width: 226, height: 340 });
    });

    it('keeps a PNG cover in PNG', async () => {
        const thumbnail = await cover(
            'png',
            { width: 300, height: 300 },
            { width: 200, height: 300 },
        );

        const trimmed = await new SharpCoverTrimmer().trim(thumbnail);

        expect(trimmed.mediaType).toBe('image/png');
        expect(await size(trimmed)).toEqual({ width: 200, height: 300 });
    });

    it('keeps a WebP cover in WebP', async () => {
        const thumbnail = await cover(
            'webp',
            { width: 300, height: 300 },
            { width: 200, height: 300 },
        );

        const trimmed = await new SharpCoverTrimmer().trim(thumbnail);

        expect(trimmed.mediaType).toBe('image/webp');
        expect(await size(trimmed)).toEqual({ width: 200, height: 300 });
    });

    it('returns a cover without padding unchanged', async () => {
        const portrait = await cover('jpeg', { width: 200, height: 300 });

        const result = await new SharpCoverTrimmer().trim(portrait);

        expect(result).toBe(portrait);
    });

    it('returns a cover it cannot decode unchanged', async () => {
        const damaged = CoverImage.from(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]));

        const result = await new SharpCoverTrimmer().trim(damaged);

        expect(result).toBe(damaged);
    });
});
