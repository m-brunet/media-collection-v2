import { describe, expect, it } from 'vitest';
import type { ActivityOperation, ActivityRecord } from './activity-projection.service.js';
import { ActivityProjection } from './activity-projection.service.js';

function record(
    category: string,
    after: Record<string, unknown> | null,
    before: Record<string, unknown> | null = null,
    overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
    return { category, subjectId: 'subject-1', before, after, currentTitle: null, ...overrides };
}

function operation(...records: ActivityRecord[]): ActivityOperation {
    return {
        id: 'operation-1',
        occurredAt: '2026-11-01T12:42:00.000Z',
        actorId: 'user-alex',
        actor: 'Alex',
        records,
    };
}

function loan(title: string, receiver = 'Sam'): Record<string, unknown> {
    return { loan: { title, receiver: { id: 'receiver-1', name: receiver }, status: 'lent' } };
}

describe('ActivityProjection', () => {
    it('describes an added book with its operation, time and acting account', () => {
        const added = operation(record('book.created', { title: 'Dune', ownership: 'owned' }));

        const entry = ActivityProjection.entry(added);

        expect(entry).toEqual({
            id: 'operation-1',
            occurredAt: '2026-11-01T12:42:00.000Z',
            actor: 'Alex',
            event: { kind: 'book-added', title: 'Dune' },
            also: [],
        });
    });
    it('describes a Not Owned book added like any other book', () => {
        const added = operation(record('book.created', { title: 'Dune', ownership: 'not_owned' }));

        const entry = ActivityProjection.entry(added);

        expect(entry?.event).toEqual({ kind: 'book-added', title: 'Dune' });
    });
    it('describes a book marked Owned', () => {
        const marked = operation(
            record('book.marked-owned', { title: 'Dune', ownership: 'owned' }, { title: 'Dune' }),
        );

        const entry = ActivityProjection.entry(marked);

        expect(entry?.event).toEqual({ kind: 'book-marked-owned', title: 'Dune' });
    });
    it('names a deleted book from the record before its deletion', () => {
        const deleted = operation(record('book.deleted', null, { title: 'Dune' }));

        const entry = ActivityProjection.entry(deleted);

        expect(entry?.event).toEqual({ kind: 'book-deleted', title: 'Dune' });
    });
    it('names the book of an older location change from its current title', () => {
        const organised = operation(
            record('book.organised', { tags: [] }, { tags: [] }, { currentTitle: 'Dune' }),
        );

        const entry = ActivityProjection.entry(organised);

        expect(entry?.event).toEqual({ kind: 'book-organised', title: 'Dune' });
    });
    it('says a book was moved when only its location changed', () => {
        const moved = operation(
            record(
                'book.organised',
                { title: 'Dune', location: { shelfId: 'shelf-3' }, tags: [{ id: 'fantasy' }] },
                { title: 'Dune', location: null, tags: [{ id: 'fantasy' }] },
            ),
        );

        const entry = ActivityProjection.entry(moved);

        expect(entry?.event).toEqual({ kind: 'book-relocated', title: 'Dune' });
    });
    it('says the tags of a book changed when only its tags changed', () => {
        const retagged = operation(
            record(
                'book.organised',
                { title: 'Dune', location: { shelfId: 'shelf-3' }, tags: [{ id: 'history' }] },
                { title: 'Dune', location: { shelfId: 'shelf-3' }, tags: [{ id: 'fantasy' }] },
            ),
        );

        const entry = ActivityProjection.entry(retagged);

        expect(entry?.event).toEqual({ kind: 'book-retagged', title: 'Dune' });
    });
    it('reads the same tags in another order as unchanged', () => {
        const moved = operation(
            record(
                'book.organised',
                { title: 'Dune', location: null, tags: [{ id: 'b' }, { id: 'a' }] },
                {
                    title: 'Dune',
                    location: { shelfId: 'shelf-3' },
                    tags: [{ id: 'a' }, { id: 'b' }],
                },
            ),
        );

        const entry = ActivityProjection.entry(moved);

        expect(entry?.event).toEqual({ kind: 'book-relocated', title: 'Dune' });
    });
    it('keeps the general sentence when both the location and the tags changed', () => {
        const both = operation(
            record(
                'book.organised',
                { title: 'Dune', location: { shelfId: 'shelf-3' }, tags: [{ id: 'history' }] },
                { title: 'Dune', location: null, tags: [] },
            ),
        );

        const entry = ActivityProjection.entry(both);

        expect(entry?.event).toEqual({ kind: 'book-organised', title: 'Dune' });
    });
    it('leaves the title out when an older record names a book deleted since', () => {
        const covered = operation(record('book.cover-changed', { hasCover: true }));

        const entry = ActivityProjection.entry(covered);

        expect(entry?.event).toEqual({ kind: 'book-cover-changed', title: null });
    });
    it('groups a lending of three books into one entry naming the receiver', () => {
        const lending = operation(
            record('loan.lent', loan('Piranesi')),
            record('loan.lent', loan('Dune')),
            record('loan.lent', loan('Emma')),
        );

        const entry = ActivityProjection.entry(lending);

        expect(entry?.event).toEqual({
            kind: 'books-lent',
            receiver: 'Sam',
            titles: ['Dune', 'Emma', 'Piranesi'],
        });
        expect(entry?.also).toEqual([]);
    });
    it('keeps a lending that created its receiver as one entry', () => {
        const lending = operation(
            record('receiver.created', { name: 'Sam' }),
            record('loan.lent', loan('Dune')),
        );

        const entry = ActivityProjection.entry(lending);

        expect(entry?.event).toEqual({ kind: 'books-lent', receiver: 'Sam', titles: ['Dune'] });
        expect(entry?.also).toEqual([{ kind: 'receiver-created', name: 'Sam' }]);
    });
    it('groups the returns of one receiver into one entry', () => {
        const returns = operation(
            record('loan.returned', loan('Dune'), loan('Dune')),
            record('loan.returned', loan('Emma'), loan('Emma')),
        );

        const entry = ActivityProjection.entry(returns);

        expect(entry?.event).toEqual({
            kind: 'books-returned',
            receiver: 'Sam',
            titles: ['Dune', 'Emma'],
        });
    });
    it('describes a book save with the collection and tag it created', () => {
        const save = operation(
            record('tag.created', { name: 'Fantasy' }),
            record('collection.created', { name: 'Naruto' }),
            record('book.created', { title: 'Naruto Vol. 1' }),
        );

        const entry = ActivityProjection.entry(save);

        expect(entry?.event).toEqual({ kind: 'book-added', title: 'Naruto Vol. 1' });
        expect(entry?.also).toEqual([
            { kind: 'tag-created', name: 'Fantasy' },
            { kind: 'collection-created', name: 'Naruto' },
        ]);
    });
    it('describes a book deletion that removed its emptied collection', () => {
        const deletion = operation(
            record('collection.removed', null, { name: 'Naruto' }),
            record('book.deleted', null, { title: 'Naruto Vol. 1' }),
        );

        const entry = ActivityProjection.entry(deletion);

        expect(entry?.event).toEqual({ kind: 'book-deleted', title: 'Naruto Vol. 1' });
        expect(entry?.also).toEqual([{ kind: 'collection-removed', name: 'Naruto' }]);
    });
    it('describes a collection rename without listing its retitled books', () => {
        const rename = operation(
            record('book.retitled', { title: 'Boruto Vol. 1' }, { title: 'Naruto Vol. 1' }),
            record('collection.updated', { name: 'Boruto' }, { name: 'Naruto' }),
            record('book.retitled', { title: 'Boruto Vol. 2' }, { title: 'Naruto Vol. 2' }),
        );

        const entry = ActivityProjection.entry(rename);

        expect(entry?.event).toEqual({ kind: 'collection-renamed', from: 'Naruto', to: 'Boruto' });
        expect(entry?.also).toEqual([]);
    });
    it('describes a collection category change as one entry counting its books', () => {
        const change = operation(
            record(
                'collection.updated',
                { name: 'Naruto', category: 'manga' },
                { name: 'Naruto', category: 'books' },
            ),
            record('book.category-changed', { title: 'Naruto Vol. 1' }, { title: 'Naruto Vol. 1' }),
            record('book.category-changed', { title: 'Naruto Vol. 2' }, { title: 'Naruto Vol. 2' }),
        );

        const entry = ActivityProjection.entry(change);

        expect(entry?.event).toEqual({
            kind: 'collection-category-changed',
            name: 'Naruto',
            category: 'manga',
            count: 2,
        });
        expect(entry?.also).toEqual([]);
    });
    it('describes a collection change that kept its name as an update', () => {
        const update = operation(
            record(
                'collection.updated',
                { name: 'Naruto', includesVolumeZero: true },
                { name: 'Naruto', includesVolumeZero: false },
            ),
        );

        const entry = ActivityProjection.entry(update);

        expect(entry?.event).toEqual({ kind: 'collection-updated', name: 'Naruto' });
    });
    it('describes a collection marked finished', () => {
        const finished = operation(record('collection.finished', { name: 'Naruto' }));

        const entry = ActivityProjection.entry(finished);

        expect(entry?.event).toEqual({ kind: 'collection-finished', name: 'Naruto' });
    });
    it('describes a collection reopened by a person', () => {
        const reopened = operation(record('collection.reopened', { name: 'Batman' }));

        const entry = ActivityProjection.entry(reopened);

        expect(entry?.event).toEqual({ kind: 'collection-reopened', name: 'Batman' });
    });
    it('describes a corrected author', () => {
        const corrected = operation(
            record('author.corrected', { name: 'Frank Herbert' }, { name: 'F. Herbert' }),
        );

        const entry = ActivityProjection.entry(corrected);

        expect(entry?.event).toEqual({
            kind: 'author-corrected',
            from: 'F. Herbert',
            to: 'Frank Herbert',
        });
    });
    it('describes a renamed bookcase', () => {
        const renamed = operation(record('bookcase.renamed', { name: 'Oak' }, { name: 'Pine' }));

        const entry = ActivityProjection.entry(renamed);

        expect(entry?.event).toEqual({ kind: 'bookcase-renamed', from: 'Pine', to: 'Oak' });
    });
    it('describes a deleted shelf with its bookcase', () => {
        const deleted = operation(
            record('shelf.deleted', null, { name: 'Shelf 3', bookcaseName: 'Oak' }),
        );

        const entry = ActivityProjection.entry(deleted);

        expect(entry?.event).toEqual({ kind: 'shelf-deleted', name: 'Shelf 3', bookcase: 'Oak' });
    });
    it('describes a renamed shelf with its bookcase', () => {
        const renamed = operation(
            record(
                'shelf.renamed',
                { name: 'Top', bookcaseName: 'Oak' },
                { name: 'Shelf 1', bookcaseName: 'Oak' },
            ),
        );

        const entry = ActivityProjection.entry(renamed);

        expect(entry?.event).toEqual({
            kind: 'shelf-renamed',
            from: 'Shelf 1',
            to: 'Top',
            bookcase: 'Oak',
        });
    });
    it('describes a shelf moved to another bookcase', () => {
        const moved = operation(
            record(
                'shelf.moved',
                { name: 'Shelf 3', bookcaseName: 'Oak' },
                { name: 'Shelf 3', bookcaseName: 'Pine' },
            ),
        );

        const entry = ActivityProjection.entry(moved);

        expect(entry?.event).toEqual({
            kind: 'shelf-moved',
            name: 'Shelf 3',
            from: 'Pine',
            to: 'Oak',
        });
    });
    it('describes a tag created on its own', () => {
        const created = operation(record('tag.created', { name: 'Fantasy' }));

        const entry = ActivityProjection.entry(created);

        expect(entry?.event).toEqual({ kind: 'tag-created', name: 'Fantasy' });
        expect(entry?.also).toEqual([]);
    });
    it('describes a renamed tag', () => {
        const renamed = operation(record('tag.renamed', { name: 'Sci-fi' }, { name: 'SF' }));

        const entry = ActivityProjection.entry(renamed);

        expect(entry?.event).toEqual({ kind: 'tag-renamed', from: 'SF', to: 'Sci-fi' });
    });
    it('ignores records of categories it does not describe', () => {
        const save = operation(
            record('book.reading-status-changed', { read: true }),
            record('book.updated', { title: 'Dune' }),
        );

        const entry = ActivityProjection.entry(save);

        expect(entry?.event).toEqual({ kind: 'book-updated', title: 'Dune' });
        expect(entry?.also).toEqual([]);
    });
    it('gives no entry for an operation with nothing to describe', () => {
        const personal = operation(record('book.note-changed', null));

        const entry = ActivityProjection.entry(personal);

        expect(entry).toBeNull();
    });
    it('gives no entry for a tag record without a name', () => {
        const unreadable = operation(record('tag.deleted', null, {}));

        const entry = ActivityProjection.entry(unreadable);

        expect(entry).toBeNull();
    });
});
