import { describe, expect, it } from 'vitest';
import { guest, library, otherOwner, owner, saved } from '../testing/book-doubles.test-support.js';

describe('BookViewer', () => {
    it('shows the shared information', async () => {
        const current = library();
        const book = await saved(current, { price: '9.99' });

        const result = await current.viewer.view(await current.loader.load(book.id), owner);

        expect(result).toMatchObject({
            title: 'Piranesi',
            authors: [{ name: 'Susanna Clarke' }],
            priceCents: 999,
            hasCover: false,
        });
    });
    it('shows the viewer own reading status and note', async () => {
        const current = library();
        const book = await saved(current, {}, true);

        await current.notes.save(owner.id, book.id, 'Mine.', '2026-03-01T10:00:00.000Z');

        const result = await current.viewer.view(await current.loader.load(book.id), owner);

        expect(result.personal).toEqual({
            read: true,
            note: { text: 'Mine.', updatedAt: '2026-03-01T10:00:00.000Z' },
        });
    });
    it('hides another account reading status and note', async () => {
        const current = library();
        const book = await saved(current, {}, true);

        await current.notes.save(owner.id, book.id, 'Mine.', '2026-03-01T10:00:00.000Z');

        const result = await current.viewer.view(await current.loader.load(book.id), otherOwner);

        expect(result.personal).toEqual({ read: false, note: null });
    });
    it('gives a Guest no personal information', async () => {
        const current = library();
        const book = await saved(current);

        const result = await current.viewer.view(await current.loader.load(book.id), guest);

        expect(result.personal).toBeNull();
    });
});
