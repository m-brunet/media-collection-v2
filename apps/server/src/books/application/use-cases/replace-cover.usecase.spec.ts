import { describe, expect, it } from 'vitest';
import { CoverImage } from '../../domain/value-objects/cover-image.value-object.js';
import { guest, library, owner, saved } from '../testing/book-doubles.test-support.js';
import { ReplaceCover } from './replace-cover.usecase.js';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

function subject(current: ReturnType<typeof library>) {
    return new ReplaceCover(
        current.books,
        current.covers,
        current.trimmer,
        current.loader,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('ReplaceCover', () => {
    it('stores the image and gives the book a cover', async () => {
        const current = library();
        const book = await saved(current);

        const result = await subject(current).execute(owner, book.id, png);

        expect(result.hasCover).toBe(true);
        expect(current.covers.files.size).toBe(1);
    });
    it('stores the cover without its shop padding', async () => {
        const current = library();
        const book = await saved(current);
        const trimmed = CoverImage.from(new Uint8Array([0xff, 0xd8, 0xff, 9]));

        current.trimmer.result = trimmed;

        await subject(current).execute(owner, book.id, png);

        expect(current.trimmer.received.map((cover) => cover.bytes)).toEqual([png]);
        expect(current.covers.files.get('cover-1')).toEqual({
            bytes: trimmed.bytes,
            mediaType: 'image/jpeg',
        });
    });
    it('removes the replaced image', async () => {
        const current = library();
        const book = await saved(current);

        await subject(current).execute(owner, book.id, png);

        await subject(current).execute(owner, book.id, png);

        expect([...current.covers.files.keys()]).toEqual(['cover-2']);
    });
    it('rejects a file that is not an image', async () => {
        const current = library();
        const book = await saved(current);

        const result = subject(current).execute(owner, book.id, new Uint8Array([1, 2, 3]));

        await expect(result).rejects.toMatchObject({ reason: 'cover-format' });
        expect(current.covers.files.size).toBe(0);
    });
    it('keeps no stored image when the book does not exist', async () => {
        const current = library();

        const result = subject(current).execute(owner, 'missing', png);

        await expect(result).rejects.toMatchObject({ reason: 'book-missing' });
        expect(current.covers.files.size).toBe(0);
    });
    it('refuses a Guest', async () => {
        const current = library();
        const book = await saved(current);

        const result = subject(current).execute(guest, book.id, png);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
    });
});
