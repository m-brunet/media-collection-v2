import { describe, expect, it } from 'vitest';
import type { V1Book, V1Corrections } from './v1-library-planner.service.js';
import { V1LibraryPlanner } from './v1-library-planner.service.js';

const none: V1Corrections = { isbns: [], categories: [] };

function v1(overrides: Partial<V1Book> = {}): V1Book {
    return {
        record: 1,
        title: 'Magicien - L’apprenti',
        isbn: '9782811211554',
        authors: ['Raymond E. Feist'],
        type: 'book',
        bought: true,
        read: 'READ',
        volume: 1,
        collectionName: 'La guerre de la faille',
        lastElement: false,
        pageCount: 470,
        price: 9.9,
        publisher: 'Milady',
        cover: 'http://example.test/cover.jpg',
        created: '2017-01-15T16:53:12.369Z',
        ...overrides,
    };
}

function volume(record: number, number: number, overrides: Partial<V1Book> = {}): V1Book {
    return v1({
        record,
        title: '',
        isbn: '978000000000' + record,
        type: 'manga',
        volume: number,
        collectionName: 'Gunnm',
        ...overrides,
    });
}

describe('V1LibraryPlanner', () => {
    it('maps a V1 book to the V2 fields', () => {
        const books = [v1()];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.books).toEqual([
            {
                record: 1,
                title: 'Magicien - L’apprenti',
                isbn: '9782811211554',
                authors: ['Raymond E. Feist'],
                category: 'books',
                ownership: 'owned',
                publisher: 'Milady',
                pageCount: 470,
                price: '9.9',
                collection: { name: 'La guerre de la faille', volume: 1 },
                createdAt: '2017-01-15T16:53:12.369Z',
                read: true,
                coverUrl: 'http://example.test/cover.jpg',
            },
        ]);
    });
    it('treats an unknown page count of zero as unknown', () => {
        const books = [v1({ pageCount: 0 })];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.books[0]?.pageCount).toBeNull();
    });
    it('reads only READ as read, not ongoing or to read', () => {
        const books = [
            v1({ read: 'ONGOING' }),
            v1({ record: 2, isbn: '9780306406157', read: 'NOTREAD' }),
        ];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.books.map((book) => book.read)).toEqual([false, false]);
    });
    it('maps a book not bought to Not Owned', () => {
        const books = [v1({ bought: false })];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.books[0]?.ownership).toBe('not-owned');
    });
    it('ignores the volume of a book outside any collection', () => {
        const books = [v1({ collectionName: null, volume: 3 })];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.books[0]?.collection).toBeNull();
    });
    it('fills a missing ISBN from the corrections when the title matches', () => {
        const books = [v1({ isbn: null })];
        const corrections = {
            ...none,
            isbns: [{ record: 1, title: 'Magicien - L’apprenti', isbn: '9780306406157' }],
        };

        const result = V1LibraryPlanner.plan(books, corrections);

        expect(result.books[0]?.isbn).toBe('9780306406157');
    });
    it('refuses an ISBN correction whose title does not match the record', () => {
        const books = [v1({ isbn: null })];
        const corrections = {
            ...none,
            isbns: [{ record: 1, title: 'Another book', isbn: '9780306406157' }],
        };

        const operation = () => V1LibraryPlanner.plan(books, corrections);

        expect(operation).toThrow('does not match the dump');
    });
    it('refuses a book without an ISBN', () => {
        const books = [v1({ isbn: null })];

        const operation = () => V1LibraryPlanner.plan(books, none);

        expect(operation).toThrow('Record 1 ("Magicien - L’apprenti"): no ISBN');
    });
    it('keeps a blank title for Manga in a collection, to be generated', () => {
        const books = [volume(1, 1)];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.books[0]).toMatchObject({ title: '', category: 'manga' });
    });
    it('applies the category correction to every book of the collection', () => {
        const books = [
            volume(1, 1, { type: 'book' }),
            volume(2, 2, { type: 'manga', title: 'Rusty' }),
        ];
        const corrections: V1Corrections = {
            ...none,
            categories: [{ collection: 'gunnm', category: 'manga' }],
        };

        const result = V1LibraryPlanner.plan(books, corrections);

        expect(result.books.map((book) => book.category)).toEqual(['manga', 'manga']);
    });
    it('reports every untitled Book at once, naming the collection to correct', () => {
        const books = [volume(1, 1, { type: 'book' }), volume(2, 2, { type: 'book' })];

        const operation = () => V1LibraryPlanner.plan(books, none);

        expect(operation).toThrow(
            /Record 1: no title.*\n- Record 2: no title.*"Gunnm" in category-corrections.json/s,
        );
    });
    it('refuses an unknown V1 type', () => {
        const books = [v1({ type: 'dvd' })];

        const operation = () => V1LibraryPlanner.plan(books, none);

        expect(operation).toThrow('unknown V1 type "dvd"');
    });
    it('marks Finished a collection owned up to its last volume', () => {
        const books = [volume(1, 1), volume(2, 2, { lastElement: true })];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result).toMatchObject({ finished: ['Gunnm'], unfinished: [] });
    });
    it('counts volume 0 among the expected volumes when the collection has one', () => {
        const books = [volume(1, 1), volume(2, 2, { lastElement: true }), volume(3, 0)];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.finished).toEqual(['Gunnm']);
    });
    it('uses the highest volume marked as last', () => {
        const books = [
            volume(1, 1, { lastElement: true }),
            volume(2, 2),
            volume(3, 3, { lastElement: true }),
        ];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.finished).toEqual(['Gunnm']);
    });
    it('leaves unfinished a collection with missing volumes, without inventing them', () => {
        const books = [volume(1, 1), volume(3, 3, { lastElement: true })];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.books).toHaveLength(2);
        expect(result).toMatchObject({
            finished: [],
            unfinished: [{ name: 'Gunnm', lastVolume: 3, missing: [2], beyond: [] }],
        });
    });
    it('leaves unfinished a collection with a volume beyond its last one', () => {
        const books = [volume(1, 1, { lastElement: true }), volume(2, 2)];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.unfinished).toEqual([
            { name: 'Gunnm', lastVolume: 1, missing: [], beyond: [2] },
        ]);
    });
    it('does not mark Finished a collection whose last volume is not owned', () => {
        const books = [volume(1, 1), volume(2, 2, { lastElement: true, bought: false })];

        const result = V1LibraryPlanner.plan(books, none);

        expect(result.unfinished).toMatchObject([{ name: 'Gunnm', missing: [2] }]);
    });
});
