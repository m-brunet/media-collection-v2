import { describe, expect, it } from 'vitest';
import type { BookBatchChanges, BookBatchRequest } from '../book-batch.js';
import {
    administrator,
    BookDoubles,
    guest,
    otherOwner,
    owner,
} from '../testing/book-doubles.test-support.js';
import { EditBooksInBatch } from './edit-books-in-batch.usecase.js';

function setUp() {
    const current = BookDoubles.library();

    return {
        current,
        useCase: new EditBooksInBatch(
            current.planner,
            current.resolver,
            current.books,
            current.authors,
            current.collections,
            current.organiser,
            current.readings,
            current.operations,
        ),
    };
}

function batch(bookIds: string[], changes: BookBatchChanges, preview = false): BookBatchRequest {
    return { collectionId: 'collection-Gunnm', bookIds, changes, preview };
}

describe('EditBooksInBatch', () => {
    it('saves the changes of every chosen book', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);
        const two = await BookDoubles.volume(current, 2, { price: '7' });

        const result = await useCase.execute(
            owner,
            batch([one.id, two.id], { category: 'comics', publisher: 'Glénat', price: null }),
        );

        expect(result.saved).toBe(true);
        expect(result.books.map((book) => book.id)).toEqual([one.id, two.id]);
        expect(current.books.books.get(one.id)!.details).toMatchObject({
            category: 'comics',
            publisher: 'Glénat',
            price: null,
        });
        expect(current.books.books.get(two.id)!.details).toMatchObject({
            category: 'comics',
            publisher: 'Glénat',
            price: null,
        });
    });
    it('lets the Admin edit a batch', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);

        await useCase.execute(administrator, batch([one.id], { publisher: 'Glénat' }));

        expect(current.books.books.get(one.id)!.details.publisher).toBe('Glénat');
    });
    it('previews the changes without saving anything', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);

        current.trail.entries.length = 0;

        const result = await useCase.execute(
            owner,
            batch(
                [one.id],
                { publisher: 'Glénat', read: true, shelfId: 'top', authors: [{ name: 'Ana' }] },
                true,
            ),
        );

        expect(result.saved).toBe(false);
        expect(result.books[0]!.after).toMatchObject({
            publisher: 'Glénat',
            read: true,
            authors: ['Ana'],
        });
        expect(current.books.books.get(one.id)!.details.publisher).toBeNull();
        expect(await current.readings.isRead(owner.id, one.id)).toBe(false);
        expect(current.shelving.placed.size).toBe(0);
        expect(current.authors.authors.size).toBe(1);
        expect(current.trail.entries).toEqual([]);
    });
    it('adds and removes tags and places the books on a shelf', async () => {
        const { current, useCase } = setUp();

        current.tagging.known.set('cyberpunk', 'Cyberpunk');
        const one = await BookDoubles.volume(current, 1, { tags: [{ id: 'history' }] });

        await useCase.execute(
            owner,
            batch([one.id], { tags: { add: ['cyberpunk'], remove: [] }, shelfId: 'top' }),
        );

        expect(current.tagging.tags.get(one.id)).toEqual([
            { id: 'cyberpunk', name: 'Cyberpunk' },
            { id: 'history', name: 'History' },
        ]);
        expect(current.shelving.placed.get(one.id)).toBe('top');
    });
    it('clears the shelf of the books', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1, { shelfId: 'top' });

        await useCase.execute(owner, batch([one.id], { shelfId: null }));

        expect(current.shelving.placed.has(one.id)).toBe(false);
    });
    it('replaces the authors in the typed order, creating a new one', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);

        await useCase.execute(
            owner,
            batch([one.id], { authors: [{ name: 'Ana' }, { id: one.authors[0]!.id }] }),
        );

        expect(
            current.books.books
                .get(one.id)!
                .details.authorIds.map((id) => current.authors.authors.get(id)!.snapshot.name),
        ).toEqual(['Ana', 'Yukito Kishiro']);
        expect(current.books.books.get(one.id)!.details.authorIds[1]).toBe(one.authors[0]!.id);
    });
    it('removes an author no book keeps any more', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);

        await useCase.execute(owner, batch([one.id], { authors: [{ name: 'Ana' }] }));

        expect([...current.authors.authors.values()].map((author) => author.snapshot.name)).toEqual(
            ['Ana'],
        );
    });
    it('asks about a similar author once for the whole batch', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);
        const two = await BookDoubles.volume(current, 2);

        const result = useCase.execute(
            owner,
            batch([one.id, two.id], { authors: [{ name: 'Yukito Kishir' }] }),
        );

        await expect(result).rejects.toMatchObject({
            code: 'conflict',
            reason: 'author-similar',
            details: { name: 'Yukito Kishir' },
        });
    });
    it('sets the reading status of the signed-in account only', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);

        await useCase.execute(owner, batch([one.id], { read: true }));

        expect(await current.readings.isRead(owner.id, one.id)).toBe(true);
        expect(await current.readings.isRead(otherOwner.id, one.id)).toBe(false);
    });
    it('turns hand-written titles into generated ones', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1, { title: 'Gunnm, the first' });

        await useCase.execute(owner, batch([one.id], { generatedTitles: true }));

        expect(current.books.books.get(one.id)!.details).toMatchObject({
            title: 'Gunnm Vol. 1',
            titleGenerated: true,
        });
    });
    it('keeps the generated title as a hand-written one when changing to Books', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);

        await useCase.execute(owner, batch([one.id], { category: 'books' }));

        expect(current.books.books.get(one.id)!.details).toMatchObject({
            title: 'Gunnm Vol. 1',
            titleGenerated: false,
            category: 'books',
        });
    });
    it('gives a skipped book none of the changes', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);
        const two = await BookDoubles.volume(current, 2);

        current.loans.lend(one.id);

        const result = await useCase.execute(
            owner,
            batch([one.id, two.id], { ownership: 'not-owned', publisher: 'Glénat', read: true }),
        );

        expect(result.skipped).toEqual([
            { id: one.id, title: 'Gunnm Vol. 1', reason: 'book-lent' },
        ]);
        expect(current.books.books.get(one.id)!.details).toMatchObject({
            ownership: 'owned',
            publisher: null,
        });
        expect(await current.readings.isRead(owner.id, one.id)).toBe(false);
        expect(current.books.books.get(two.id)!.details).toMatchObject({
            ownership: 'not-owned',
            publisher: 'Glénat',
        });
    });
    it('records a possible duplicate as skipped without changing it', async () => {
        const { current, useCase } = setUp();
        const other = await BookDoubles.saved(current, {
            title: 'Gunnm Vol. 1',
            isbn: null,
            noIsbn: true,
            authors: [{ name: 'Someone Else' }],
        });
        const one = await BookDoubles.volume(current, 1, { isbn: null, noIsbn: true });

        const result = await useCase.execute(
            owner,
            batch([one.id], { authors: [{ id: other.authors[0]!.id }] }),
        );

        expect(result.skipped[0]!.reason).toBe('possible-duplicate');
        expect(current.books.books.get(one.id)!.details.authorIds).toEqual([one.authors[0]!.id]);
    });
    it('records the collection change caused by a new ownership', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);
        const reopened = {
            category: 'collection.reopened',
            subjectType: 'collection',
            subjectId: 'collection-Gunnm',
            before: { finished: true },
            after: { finished: false },
        };

        current.collections.changes = [reopened];

        await useCase.execute(owner, batch([one.id], { ownership: 'not-owned' }));

        expect(current.trail.entries).toContainEqual(expect.objectContaining(reopened));
        expect(await current.collections.of(one.id)).toMatchObject({
            id: 'collection-Gunnm',
            volumeFrom: 1,
            volumeTo: 1,
        });
    });
    it('records one batch entry with each book change as a related change', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);
        const two = await BookDoubles.volume(current, 2, { publisher: 'Glénat' });

        current.trail.entries.length = 0;

        await useCase.execute(owner, batch([one.id, two.id], { publisher: 'Glénat', read: true }));

        expect(current.trail.entries).toEqual([
            expect.objectContaining({
                category: 'collection.books-batch-edited',
                outcome: 'successful',
                subjectType: 'collection',
                subjectId: 'collection-Gunnm',
                before: { name: 'Gunnm', bookIds: [one.id, two.id] },
                after: { name: 'Gunnm', edited: [one.id, two.id], skipped: [] },
            }),
            expect.objectContaining({
                category: 'book.updated',
                subjectType: 'book',
                subjectId: one.id,
                before: { title: 'Gunnm Vol. 1', publisher: null },
                after: { title: 'Gunnm Vol. 1', publisher: 'Glénat' },
            }),
            expect.objectContaining({
                category: 'book.reading-status-changed',
                subjectId: one.id,
                before: { read: false },
                after: { read: true },
            }),
            expect.objectContaining({
                category: 'book.reading-status-changed',
                subjectId: two.id,
                before: { read: false },
                after: { read: true },
            }),
        ]);
        expect(new Set(current.trail.entries.map((entry) => entry.operationId)).size).toBe(1);
    });
    it('refuses a book outside the collection and changes nothing', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);
        const outside = await BookDoubles.saved(current);

        const result = useCase.execute(owner, batch([one.id, outside.id], { publisher: 'Glénat' }));

        await expect(result).rejects.toMatchObject({ reason: 'book-outside-collection' });
        expect(current.books.books.get(one.id)!.details.publisher).toBeNull();
    });
    it('refuses a Guest', async () => {
        const { current, useCase } = setUp();
        const one = await BookDoubles.volume(current, 1);

        const result = useCase.execute(guest, batch([one.id], { publisher: 'Glénat' }, true));

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
});
