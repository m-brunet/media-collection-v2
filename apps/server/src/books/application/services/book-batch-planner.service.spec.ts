import { describe, expect, it } from 'vitest';
import type { BookBatchChanges, BookBatchRequest } from '../book-batch.js';
import { BookDoubles, otherOwner, owner } from '../testing/book-doubles.test-support.js';

function request(bookIds: string[], changes: BookBatchChanges): BookBatchRequest {
    return { collectionId: 'collection-Gunnm', bookIds, changes, preview: true };
}

describe('BookBatchPlanner', () => {
    it('plans the replaced category, ownership, publisher and price of each book', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1, { publisher: 'Glénat' });

        const result = await current.planner.plan(
            owner.id,
            request([one.id], {
                category: 'comics',
                ownership: 'not-owned',
                publisher: 'Delcourt',
                price: '6,90',
            }),
            null,
        );

        expect(result.planned[0]!.entry).toEqual({
            id: one.id,
            title: 'Gunnm Vol. 1',
            before: {
                category: 'manga',
                ownership: 'owned',
                publisher: 'Glénat',
                priceCents: null,
            },
            after: {
                category: 'comics',
                ownership: 'not-owned',
                publisher: 'Delcourt',
                priceCents: 690,
            },
        });
        expect(result.planned[0]!.ownershipChanged).toBe(true);
    });
    it('plans clearing the publisher and the price', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1, { publisher: 'Glénat', price: '7' });

        const result = await current.planner.plan(
            owner.id,
            request([one.id], { publisher: null, price: null }),
            null,
        );

        expect(result.planned[0]!.entry).toMatchObject({
            before: { publisher: 'Glénat', priceCents: 700 },
            after: { publisher: null, priceCents: null },
        });
    });
    it('fills the publisher and the price only on the books that have none', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1, { publisher: 'Glénat', price: '7' });
        const two = await BookDoubles.volume(current, 2);

        const result = await current.planner.plan(
            owner.id,
            request([one.id, two.id], {
                publisher: 'Delcourt',
                price: '6,90',
                onlyIfEmpty: ['publisher', 'price'],
            }),
            null,
        );

        expect(result.planned.map((planned) => planned.entry)).toEqual([
            { id: one.id, title: 'Gunnm Vol. 1', before: {}, after: {} },
            {
                id: two.id,
                title: 'Gunnm Vol. 2',
                before: { publisher: null, priceCents: null },
                after: { publisher: 'Delcourt', priceCents: 690 },
            },
        ]);
        expect(result.planned[0]!.detailsChanged).toBe(false);
    });
    it('fills the shelf only on the books without a location', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1, { shelfId: 'top' });
        const two = await BookDoubles.volume(current, 2);

        const result = await current.planner.plan(
            owner.id,
            request([one.id, two.id], { shelfId: 'shelf-3', onlyIfEmpty: ['shelfId'] }),
            null,
        );

        expect(result.planned[0]!.entry).toMatchObject({ before: {}, after: {} });
        expect(result.planned[0]!.organisation).toBeNull();
        expect(result.planned[1]!.entry.after.location?.shelfName).toBe('Shelf 3');
        expect(result.planned[1]!.organisation).toEqual({ shelfId: 'shelf-3' });
    });
    it('leaves every field absent from the batch unchanged', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1, { price: '7' });

        const result = await current.planner.plan(
            owner.id,
            request([one.id], { publisher: 'Glénat' }),
            null,
        );

        expect(result.planned[0]!.entry.before).toEqual({ publisher: null });
        expect(result.planned[0]!.entry.after).toEqual({ publisher: 'Glénat' });
        expect(result.planned[0]!.organisation).toBeNull();
        expect(result.planned[0]!.read).toBeNull();
    });
    it('plans a book already as asked without any change', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1, { publisher: 'Glénat' });

        const result = await current.planner.plan(
            owner.id,
            request([one.id], { publisher: 'Glénat', category: 'manga' }),
            null,
        );

        expect(result.planned[0]!.entry).toMatchObject({ before: {}, after: {} });
        expect(result.planned[0]!.detailsChanged).toBe(false);
    });
    it('adds and removes tags, keeping the other tags of each book', async () => {
        const current = BookDoubles.library();

        current.tagging.known.set('cyberpunk', 'Cyberpunk');
        current.tagging.known.set('old', 'Old');
        const one = await BookDoubles.volume(current, 1, {
            tags: [{ id: 'history' }, { id: 'old' }],
        });

        const result = await current.planner.plan(
            owner.id,
            request([one.id], { tags: { add: ['cyberpunk'], remove: ['old'] } }),
            null,
        );

        expect(result.planned[0]!.entry).toMatchObject({
            before: {
                tags: [
                    { id: 'history', name: 'History' },
                    { id: 'old', name: 'Old' },
                ],
            },
            after: {
                tags: [
                    { id: 'cyberpunk', name: 'Cyberpunk' },
                    { id: 'history', name: 'History' },
                ],
            },
        });
        expect(result.planned[0]!.organisation).toEqual({
            tags: [{ id: 'cyberpunk' }, { id: 'history' }],
        });
    });
    it('plans the shelf with its location, or no location once cleared', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1, { shelfId: 'top' });
        const two = await BookDoubles.volume(current, 2);

        const result = await current.planner.plan(
            owner.id,
            request([one.id, two.id], { shelfId: 'shelf-3' }),
            null,
        );

        expect(result.planned.map((planned) => planned.entry.after.location?.shelfName)).toEqual([
            'Shelf 3',
            'Shelf 3',
        ]);
        expect(result.planned[0]!.entry.before.location?.shelfName).toBe('Top');
        expect(result.planned[1]!.entry.before.location).toBeNull();
    });
    it('replaces the authors with the typed ones, in their order', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);

        const result = await current.planner.plan(
            owner.id,
            request([one.id], { authors: [{ name: 'Ana' }, { name: 'Bo' }] }),
            [
                { id: null, name: 'Ana' },
                { id: one.authors[0]!.id, name: 'Yukito Kishiro' },
            ],
        );

        expect(result.planned[0]!.entry).toMatchObject({
            before: { authors: ['Yukito Kishiro'] },
            after: { authors: ['Ana', 'Yukito Kishiro'] },
        });
    });
    it('plans the reading status of the reader only', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);
        const two = await BookDoubles.volume(current, 2);

        await current.readings.set(owner.id, two.id, true);
        await current.readings.set(otherOwner.id, one.id, true);

        const result = await current.planner.plan(
            owner.id,
            request([one.id, two.id], { read: true }),
            null,
        );

        expect(result.planned.map((planned) => planned.read)).toEqual([true, null]);
        expect(result.planned[0]!.entry).toMatchObject({
            before: { read: false },
            after: { read: true },
        });
    });
    it('turns the hand-written titles of Manga into generated ones', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1, { title: 'Gunnm, the first' });
        const two = await BookDoubles.volume(current, 2);

        const result = await current.planner.plan(
            owner.id,
            request([one.id, two.id], { generatedTitles: true }),
            null,
        );

        expect(result.planned.map((planned) => planned.entry)).toEqual([
            {
                id: one.id,
                title: 'Gunnm, the first',
                before: { title: 'Gunnm, the first', titleGenerated: false },
                after: { title: 'Gunnm Vol. 1', titleGenerated: true },
            },
            { id: two.id, title: 'Gunnm Vol. 2', before: {}, after: {} },
        ]);
    });
    it('skips a Books book when generating titles', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1, {
            title: 'Gunnm, the novel',
            category: 'books',
        });

        const result = await current.planner.plan(
            owner.id,
            request([one.id], { generatedTitles: true, publisher: 'Glénat' }),
            null,
        );

        expect(result.planned).toEqual([]);
        expect(result.skipped).toEqual([
            { id: one.id, title: 'Gunnm, the novel', reason: 'title-not-generated' },
        ]);
    });
    it('keeps a generated title as a hand-written one when changing to Books', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);

        const result = await current.planner.plan(
            owner.id,
            request([one.id], { category: 'books' }),
            null,
        );

        expect(result.planned[0]!.entry).toMatchObject({
            before: { titleGenerated: true, category: 'manga' },
            after: { titleGenerated: false, category: 'books' },
        });
        expect(result.planned[0]!.book.details.title).toBe('Gunnm Vol. 1');
    });
    it('skips a lent book set to Not owned', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);
        const two = await BookDoubles.volume(current, 2);

        current.loans.lend(one.id);

        const result = await current.planner.plan(
            owner.id,
            request([one.id, two.id], { ownership: 'not-owned' }),
            null,
        );

        expect(result.skipped).toEqual([
            { id: one.id, title: 'Gunnm Vol. 1', reason: 'book-lent' },
        ]);
        expect(result.planned.map((planned) => planned.book.id)).toEqual([two.id]);
    });
    it('skips a book whose new authors make it a possible duplicate', async () => {
        const current = BookDoubles.library();
        const other = await BookDoubles.saved(current, {
            title: 'Gunnm Vol. 1',
            isbn: null,
            noIsbn: true,
            authors: [{ name: 'Someone Else' }],
        });
        const one = await BookDoubles.volume(current, 1, { isbn: null, noIsbn: true });

        const result = await current.planner.plan(
            owner.id,
            request([one.id], { authors: [{ id: other.authors[0]!.id }] }),
            [{ id: other.authors[0]!.id, name: 'Someone Else' }],
        );

        expect(result.skipped).toEqual([
            { id: one.id, title: 'Gunnm Vol. 1', reason: 'possible-duplicate' },
        ]);
    });
    it('does not compare the books of the batch with each other', async () => {
        const current = BookDoubles.library();
        const noIsbn = { isbn: null, noIsbn: true };
        const one = await BookDoubles.volume(current, 1, noIsbn);
        const two = await BookDoubles.volume(current, 2, {
            ...noIsbn,
            confirmDistinct: true,
            authors: [{ name: 'Yukito Kishiro' }, { name: 'Ana', distinct: true }],
        });

        const result = await current.planner.plan(
            owner.id,
            request([one.id, two.id], { authors: [{ name: 'Ana' }] }),
            [{ id: two.authors[1]!.id, name: 'Ana' }],
        );

        expect(result.skipped).toEqual([]);
        expect(result.planned).toHaveLength(2);
    });
    it('refuses the whole batch when one book is outside the collection', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);
        const outside = await BookDoubles.saved(current);

        const result = current.planner.plan(
            owner.id,
            request([one.id, outside.id], { publisher: 'Glénat' }),
            null,
        );

        await expect(result).rejects.toMatchObject({
            code: 'invalid_input',
            reason: 'book-outside-collection',
        });
    });
    it('refuses an unknown shelf', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);

        const result = current.planner.plan(owner.id, request([one.id], { shelfId: 'gone' }), null);

        await expect(result).rejects.toMatchObject({ reason: 'shelf-missing' });
    });
    it('changes nothing stored while planning', async () => {
        const current = BookDoubles.library();
        const one = await BookDoubles.volume(current, 1);

        await current.planner.plan(
            owner.id,
            request([one.id], { publisher: 'Glénat', read: true, shelfId: 'top' }),
            null,
        );

        expect(current.books.books.get(one.id)!.details.publisher).toBeNull();
        expect(await current.readings.isRead(owner.id, one.id)).toBe(false);
        expect(current.shelving.placed.size).toBe(0);
    });
});
