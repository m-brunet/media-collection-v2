import { describe, expect, it } from 'vitest';
import { BookDoubles } from '../testing/book-doubles.test-support.js';
import { KeptCovers } from './kept-covers.service.js';

const isbn = '9782253164692';

async function setup() {
    const current = BookDoubles.library();
    const file = await current.covers.store(new Uint8Array([1, 2, 3]), 'image/png');

    return { current, file, kept: current.kept };
}

describe('KeptCovers', () => {
    it('keeps a cover under its ISBN, with the date', async () => {
        const { current, file, kept } = await setup();

        await kept.keep(isbn, file);

        expect(current.keptStore.kept.get(isbn)).toMatchObject({
            isbn13: isbn,
            file,
            keptAt: '2026-03-01T10:00:00.000Z',
        });
        expect(current.covers.files.has(file)).toBe(true);
    });

    it('deletes the cover of a book without an ISBN', async () => {
        const { current, file, kept } = await setup();

        await kept.keep(null, file);

        expect(current.covers.files.size).toBe(0);
        expect(current.keptStore.kept.size).toBe(0);
    });

    it('keeps nothing without a cover', async () => {
        const { current, kept } = await setup();

        await kept.keep(isbn, null);

        expect(current.keptStore.kept.size).toBe(0);
    });

    it('replaces the cover kept earlier for the same ISBN and deletes its file', async () => {
        const { current, file, kept } = await setup();
        const later = await current.covers.store(new Uint8Array([4]), 'image/png');

        await kept.keep(isbn, file);

        await kept.keep(isbn, later);

        expect(current.keptStore.kept.get(isbn)?.file).toBe(later);
        expect([...current.covers.files.keys()]).toEqual([later]);
    });

    it('releases the kept cover of an ISBN and deletes its file', async () => {
        const { current, file, kept } = await setup();

        await kept.keep(isbn, file);

        await kept.release(isbn);

        expect(current.keptStore.kept.size).toBe(0);
        expect(current.covers.files.size).toBe(0);
    });

    it('releases nothing for an ISBN without a kept cover', async () => {
        const { current, file, kept } = await setup();

        await kept.release(isbn);

        expect(current.covers.files.has(file)).toBe(true);
    });

    it('releases nothing without an ISBN', async () => {
        const { current, file, kept } = await setup();

        await kept.keep(isbn, file);

        await kept.release(null);

        expect(current.keptStore.kept.size).toBe(1);
    });

    it('forgets the kept cover of an ISBN and leaves its file to the cleanup', async () => {
        const { current, file, kept } = await setup();

        await kept.keep(isbn, file);

        await kept.forget(isbn);

        expect(current.keptStore.kept.size).toBe(0);
        expect(current.covers.files.has(file)).toBe(true);
    });

    it('offers the kept cover of an ISBN as a cover that needs no download', async () => {
        const { file, kept } = await setup();

        await kept.keep(isbn, file);

        const offer = await kept.offer(isbn);

        expect(offer).toEqual({
            address: 'kept:' + file,
            width: null,
            height: null,
            fingerprint: null,
        });
        expect(KeptCovers.isKept(offer!.address)).toBe(true);
    });

    it('offers nothing for an ISBN without a kept cover', async () => {
        const { kept } = await setup();

        const offer = await kept.offer(isbn);

        expect(offer).toBeNull();
    });

    it('reads the picture of a kept cover', async () => {
        const { file, kept } = await setup();

        await kept.keep(isbn, file);

        const bytes = await kept.read('kept:' + file);

        expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('does not take a web address for a kept cover', () => {
        const kept = KeptCovers.isKept('https://covers.example/1-L.jpg');

        expect(kept).toBe(false);
    });
});
