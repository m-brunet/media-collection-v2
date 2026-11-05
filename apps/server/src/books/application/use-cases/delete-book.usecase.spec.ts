import { describe, expect, it } from 'vitest';
import { guest, library, owner, saved } from '../testing/book-doubles.test-support.js';
import { DeleteBook } from './delete-book.usecase.js';

function subject(current: ReturnType<typeof library>) {
    return new DeleteBook(current.removal, current.collections, current.covers, current.operations);
}

describe('DeleteBook', () => {
    it('deletes the book and its now unused author', async () => {
        const current = library();
        const book = await saved(current);

        await subject(current).execute(owner, book.id);

        expect(current.books.books.size).toBe(0);
        expect(current.authors.authors.size).toBe(0);
    });
    it('removes the cover file', async () => {
        const current = library();
        const book = await saved(current);
        const file = await current.covers.store(new Uint8Array([1]), 'image/png');
        const stored = current.books.books.get(book.id)!;

        stored.replaceCover(file, '2026-03-01T10:00:00.000Z');

        await subject(current).execute(owner, book.id);

        expect(current.covers.files.size).toBe(0);
    });
    it('records the deleted information', async () => {
        const current = library();
        const book = await saved(current);

        await subject(current).execute(owner, book.id);

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.deleted',
            before: expect.objectContaining({ title: 'Piranesi' }),
            after: null,
        });
    });
    it('refuses a Guest and keeps the book', async () => {
        const current = library();
        const book = await saved(current);

        const result = subject(current).execute(guest, book.id);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(current.books.books.size).toBe(1);
    });
    it('ends the collection membership of the deleted book', async () => {
        const current = library();
        const book = await saved(current, {
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });

        await subject(current).execute(owner, book.id);

        expect(current.collections.memberships.has(book.id)).toBe(false);
        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.deleted',
            before: { collection: { name: 'Batman', volumeFrom: 1, volumeTo: 1 } },
        });
    });
    it('records the collection change in the same operation', async () => {
        const current = library();
        const book = await saved(current, {
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 1 },
        });

        current.collections.changes = [
            {
                category: 'collection.removed',
                subjectType: 'collection',
                subjectId: 'collection-Batman',
                before: { name: 'Batman', includesVolumeZero: false, finished: false },
                after: null,
            },
        ];

        await subject(current).execute(owner, book.id);

        expect(current.trail.entries.slice(-2)).toEqual([
            expect.objectContaining({ operationId: 'operation-2', category: 'book.deleted' }),
            expect.objectContaining({
                operationId: 'operation-2',
                category: 'collection.removed',
                subjectId: 'collection-Batman',
            }),
        ]);
    });
});
