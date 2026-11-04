import { expect, it } from 'vitest';
import { CoverImage } from './cover-image.value-object.js';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

it('recognises a PNG image', () => {
    const bytes = png;

    const result = CoverImage.from(bytes);

    expect(result.mediaType).toBe('image/png');
});

it('recognises a JPEG image', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);

    const result = CoverImage.from(bytes);

    expect(result.mediaType).toBe('image/jpeg');
});

it('recognises a WebP image', () => {
    const bytes = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');

    const result = CoverImage.from(bytes);

    expect(result.mediaType).toBe('image/webp');
});

it('rejects a file that is not a supported image', () => {
    const bytes = new TextEncoder().encode('<svg></svg>');

    const operation = () => CoverImage.from(bytes);

    expect(operation).toThrow(expect.objectContaining({ reason: 'cover-format' }));
});

it('rejects an empty file', () => {
    const bytes = new Uint8Array();

    const operation = () => CoverImage.from(bytes);

    expect(operation).toThrow(expect.objectContaining({ reason: 'cover-too-large' }));
});
