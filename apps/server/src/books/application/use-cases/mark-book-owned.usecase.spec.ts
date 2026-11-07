import { describe, expect, it } from 'vitest';
import { guest, library, owner, saved } from '../testing/book-doubles.test-support.js';
import { MarkBookOwned } from './mark-book-owned.usecase.js';

function subject(current: ReturnType<typeof library>) {
    return new MarkBookOwned(
        current.books,
        current.loader,
        current.collections,
        current.viewer,
        current.clock,
        current.operations,
    );
}

describe('MarkBookOwned', () => {
    it('marks a Not Owned book of a collection Owned', async () => {
        const current = library();
        const book = await saved(current, {
            ownership: 'not-owned',
            collection: { collection: { name: 'Batman' }, volumeFrom: 12, volumeTo: 12 },
        });

        const result = await subject(current).execute(owner, book.id);

        expect(result.ownership).toBe('owned');
        expect((await current.books.findById(book.id))?.details.ownership).toBe('owned');
    });

    it('marks a standalone Not Owned book Owned', async () => {
        const current = library();
        const book = await saved(current, { ownership: 'not-owned' });

        const result = await subject(current).execute(owner, book.id);

        expect(result.ownership).toBe('owned');
    });

    it('marks a Not Owned omnibus Owned', async () => {
        const current = library();
        const book = await saved(current, {
            ownership: 'not-owned',
            collection: { collection: { name: 'Batman' }, volumeFrom: 1, volumeTo: 3 },
        });

        const result = await subject(current).execute(owner, book.id);

        expect(result.ownership).toBe('owned');
    });

    it('records the ownership change in the audit', async () => {
        const current = library();
        const book = await saved(current, { ownership: 'not-owned' });

        await subject(current).execute(owner, book.id);

        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.updated',
            outcome: 'successful',
            actorId: owner.id,
            subjectId: book.id,
            before: { ownership: 'not-owned' },
            after: { ownership: 'owned' },
        });
    });

    it('refuses an Owned book and records the failed attempt', async () => {
        const current = library();
        const book = await saved(current, { ownership: 'owned' });

        const operation = subject(current).execute(owner, book.id);

        await expect(operation).rejects.toMatchObject({ reason: 'book-already-owned' });
        expect(current.trail.entries.at(-1)).toMatchObject({
            category: 'book.updated',
            outcome: 'failed',
        });
    });

    it('refuses a Guest', async () => {
        const current = library();
        const book = await saved(current, { ownership: 'not-owned' });

        const operation = subject(current).execute(guest, book.id);

        await expect(operation).rejects.toMatchObject({ code: 'forbidden' });
        expect((await current.books.findById(book.id))?.details.ownership).toBe('not-owned');
    });

    it('refuses an unknown book', async () => {
        const current = library();

        const operation = subject(current).execute(owner, 'unknown');

        await expect(operation).rejects.toMatchObject({ code: 'not_found' });
    });
});
