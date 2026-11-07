import { expect, it } from 'vitest';
import { CoverFile } from './cover-file.util';

it('accepts a JPEG, PNG or WebP picture up to 10 MB', () => {
    const picture = new Blob([new Uint8Array(10)], { type: 'image/webp' });

    const result = CoverFile.problem(picture);

    expect(result).toBeNull();
});

it('refuses another kind of file', () => {
    const picture = new Blob([new Uint8Array(10)], { type: 'image/gif' });

    const result = CoverFile.problem(picture);

    expect(result).toBe('format');
});

it('refuses a picture over 10 MB', () => {
    const picture = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/jpeg' });

    const result = CoverFile.problem(picture);

    expect(result).toBe('size');
});
