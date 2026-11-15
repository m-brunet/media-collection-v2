import { afterEach, describe, expect, it } from 'vitest';
import type { BookFilterCriteria } from '../../apps/server/src/shared/application/book-filter.js';
import { BookFilter } from '../../apps/server/src/shared/application/book-filter.js';
import { LibraryRows } from './library-rows.test-support.js';

afterEach(async () => {
    await LibraryRows.close();
});

async function titles(
    current: Awaited<ReturnType<typeof LibraryRows.open>>,
    criteria: Partial<BookFilterCriteria>,
    search = '',
    readerId: string | null = null,
) {
    const page = await current.catalog.search({
        search,
        sort: 'title',
        direction: 'asc',
        offset: 0,
        limit: 48,
        readerId,
        filter: BookFilter.of(criteria),
    });

    return page.items.map((item) => item.title);
}

describe('KyselyBookCatalog filters', () => {
    it('accepts either chosen category but requires ownership and location (example 8)', async () => {
        const current = await LibraryRows.open();
        const oak = await current.bookcase('Oak');
        const top = await current.shelf(oak);
        const hall = await current.shelf(await current.bookcase('Hall'));

        await current.book({ title: 'Manga A', category: 'manga', shelfId: top });
        await current.book({ title: 'Comics A', category: 'comics', shelfId: top });
        await current.book({ title: 'Novel A', category: 'books', shelfId: top });
        await current.book({
            title: 'Manga planned',
            category: 'manga',
            ownership: 'not-owned',
            shelfId: top,
        });
        await current.book({ title: 'Manga elsewhere', category: 'manga', shelfId: hall });

        const result = await titles(current, {
            categories: ['manga', 'comics'],
            ownerships: ['owned'],
            locations: { bookcaseIds: [oak], shelfIds: [], none: false },
        });

        expect(result).toEqual(['Comics A', 'Manga A']);
    });
    it('requires every included tag and rejects any excluded tag (example 9)', async () => {
        const current = await LibraryRows.open();
        const fantasy = await current.tag('Fantasy');
        const adventure = await current.tag('Adventure');
        const medieval = await current.tag('Medieval');

        await current.book({ title: 'Both', tagIds: [fantasy, adventure] });
        await current.book({ title: 'Both and medieval', tagIds: [fantasy, adventure, medieval] });
        await current.book({ title: 'Only fantasy', tagIds: [fantasy] });

        const result = await titles(current, {
            tags: { include: [fantasy, adventure], exclude: [medieval] },
        });

        expect(result).toEqual(['Both']);
    });
    it('narrows the filtered books with the search text (example 9)', async () => {
        const current = await LibraryRows.open();
        const fantasy = await current.tag('Fantasy');

        await current.book({ title: 'Earthsea', tagIds: [fantasy] });
        await current.book({ title: 'Gormenghast', tagIds: [fantasy] });
        await current.book({ title: 'Gormenghast untagged' });

        const result = await titles(
            current,
            { tags: { include: [fantasy], exclude: [] } },
            'gormen',
        );

        expect(result).toEqual(['Gormenghast']);
    });
    it('selects books without a location or a collection (example 10)', async () => {
        const current = await LibraryRows.open();
        const top = await current.shelf(await current.bookcase('Oak'));
        const batman = await current.collection('Batman');

        await current.book({ title: 'Shelved', shelfId: top });
        await current.book({ title: 'Member', collectionId: batman });
        await current.book({ title: 'Loose' });

        const result = await titles(current, {
            locations: { bookcaseIds: [], shelfIds: [], none: true },
            collections: { ids: [], none: true },
        });

        expect(result).toEqual(['Loose']);
    });
    it('accepts a chosen collection or no collection together', async () => {
        const current = await LibraryRows.open();
        const batman = await current.collection('Batman');
        const dune = await current.collection('Dune');

        await current.book({ title: 'Batman 1', collectionId: batman });
        await current.book({ title: 'Dune 1', collectionId: dune });
        await current.book({ title: 'Standalone' });

        const result = await titles(current, { collections: { ids: [batman], none: true } });

        expect(result).toEqual(['Batman 1', 'Standalone']);
    });
    it('filters on the reading status of the reader only', async () => {
        const current = await LibraryRows.open();
        const camille = await current.reader();
        const sam = await current.reader();

        await current.book({ title: 'Read by Camille', readBy: camille });
        await current.book({ title: 'Read by Sam', readBy: sam });

        const result = await titles(current, { reading: ['unread'] }, '', camille);

        expect(result).toEqual(['Read by Sam']);
    });
    it('selects the books without a cover', async () => {
        const current = await LibraryRows.open();

        await current.book({ title: 'Covered', cover: 'covered.jpg' });
        await current.book({ title: 'Bare' });

        const result = await titles(current, { covers: ['without'] });

        expect(result).toEqual(['Bare']);
    });
    it('selects the books with a cover', async () => {
        const current = await LibraryRows.open();

        await current.book({ title: 'Covered', cover: 'covered.jpg' });
        await current.book({ title: 'Bare' });

        const result = await titles(current, { covers: ['with'] });

        expect(result).toEqual(['Covered']);
    });
    it('selects the books without a price', async () => {
        const current = await LibraryRows.open();

        await current.book({ title: 'Priced', priceCents: 1290 });
        await current.book({ title: 'Unpriced' });
        await current.book({ title: 'Unpriced wish', ownership: 'not-owned' });

        const result = await titles(current, { prices: ['without'] });

        expect(result).toEqual(['Unpriced', 'Unpriced wish']);
    });
    it('selects the books with a price', async () => {
        const current = await LibraryRows.open();

        await current.book({ title: 'Priced', priceCents: 1290 });
        await current.book({ title: 'Unpriced' });

        const result = await titles(current, { prices: ['with'] });

        expect(result).toEqual(['Priced']);
    });
    it('keeps every book when both cover and price choices are chosen', async () => {
        const current = await LibraryRows.open();

        await current.book({ title: 'Complete', cover: 'complete.jpg', priceCents: 990 });
        await current.book({ title: 'Empty' });

        const result = await titles(current, {
            covers: ['with', 'without'],
            prices: ['with', 'without'],
        });

        expect(result).toEqual(['Complete', 'Empty']);
    });
    it('selects the books missing both a cover and a price', async () => {
        const current = await LibraryRows.open();

        await current.book({ title: 'Complete', cover: 'complete.jpg', priceCents: 990 });
        await current.book({ title: 'Cover only', cover: 'cover-only.jpg' });
        await current.book({ title: 'Price only', priceCents: 990 });
        await current.book({ title: 'Empty' });

        const result = await titles(current, { covers: ['without'], prices: ['without'] });

        expect(result).toEqual(['Empty']);
    });
    it('finds partial names ignoring case and accents (example 14)', async () => {
        const current = await LibraryRows.open();

        await current.book({ title: 'The Hobbit', author: 'J. R. R. Tolkien' });
        await current.book({ title: 'Élan vital' });
        await current.book({ title: 'Dune', author: 'Frank Herbert' });

        const result = [await titles(current, {}, 'TOLK'), await titles(current, {}, 'elan')];

        expect(result).toEqual([['The Hobbit'], ['Élan vital']]);
    });
    it('finds a book from the equivalent ISBN-10 (example 14)', async () => {
        const current = await LibraryRows.open();

        await current.book({ title: 'Rasselas', isbn13: '9780306406157' });

        const result = await titles(current, {}, '0-306-40615-2');

        expect(result).toEqual(['Rasselas']);
    });
});

describe('KyselyBookCatalog collection matches', () => {
    it('excludes a collection whose books each satisfy only part of the filter (example 11)', async () => {
        const current = await LibraryRows.open();
        const fantasy = await current.tag('Fantasy');
        const split = await current.collection('Split');
        const whole = await current.collection('Whole');

        await current.book({
            title: 'Split 1',
            collectionId: split,
            volume: 1,
            author: 'Ursula Le Guin',
        });
        await current.book({ title: 'Split 2', collectionId: split, volume: 2, tagIds: [fantasy] });
        await current.book({
            title: 'Whole 1',
            collectionId: whole,
            author: 'Ursula Le Guin',
            tagIds: [fantasy],
        });

        const result = await current.catalog.collectionsMatching(
            'le guin',
            BookFilter.of({ tags: { include: [fantasy], exclude: [] } }),
            null,
        );

        expect(result).toEqual([whole]);
    });
    it('matches a collection through any one of its books', async () => {
        const current = await LibraryRows.open();
        const batman = await current.collection('Batman');

        await current.book({
            title: 'Year One',
            collectionId: batman,
            volume: 1,
            category: 'comics',
        });
        await current.book({ title: 'Hush', collectionId: batman, volume: 2, category: 'books' });

        const result = await current.catalog.collectionsMatching(
            '',
            BookFilter.of({ categories: ['comics'] }),
            null,
        );

        expect(result).toEqual([batman]);
    });
    it('matches a collection with one volume without a cover', async () => {
        const current = await LibraryRows.open();
        const dune = await current.collection('Dune');
        const batman = await current.collection('Batman');

        await current.book({ title: 'Dune 1', collectionId: dune, volume: 1, cover: 'dune-1.jpg' });
        await current.book({ title: 'Dune 2', collectionId: dune, volume: 2 });
        await current.book({ title: 'Batman 1', collectionId: batman, cover: 'batman-1.jpg' });

        const result = await current.catalog.collectionsMatching(
            '',
            BookFilter.of({ covers: ['without'] }),
            null,
        );

        expect(result).toEqual([dune]);
    });
});

describe('KyselyBookCatalog shelf order', () => {
    async function shelved(current: Awaited<ReturnType<typeof LibraryRows.open>>) {
        const page = await current.catalog.search({
            search: '',
            sort: 'shelf',
            direction: 'asc',
            offset: 0,
            limit: 48,
            readerId: null,
            filter: BookFilter.of({}),
        });

        return page.items.map((item) => item.title);
    }

    it('keeps the volumes of a collection together at the place of its name', async () => {
        const current = await LibraryRows.open();
        const saga = await current.collection('Saga');

        await current.book({ title: 'Zeta' });
        await current.book({ title: 'Book Three', collectionId: saga, volume: 3 });
        await current.book({ title: 'Alpha' });
        await current.book({ title: 'Book One', collectionId: saga, volume: 1 });
        await current.book({ title: 'Book Two', collectionId: saga, volume: 2 });

        const result = await shelved(current);

        expect(result).toEqual(['Alpha', 'Book One', 'Book Two', 'Book Three', 'Zeta']);
    });
    it('places a book in no collection at its title', async () => {
        const current = await LibraryRows.open();
        const middle = await current.collection('Middle');

        await current.book({ title: 'Nadir' });
        await current.book({ title: 'Apex', collectionId: middle, volume: 1 });
        await current.book({ title: 'Lumen' });

        const result = await shelved(current);

        expect(result).toEqual(['Lumen', 'Apex', 'Nadir']);
    });
});
