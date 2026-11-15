import { afterEach, expect, it } from 'vitest';
import { KyselyBookcaseSpineReader } from '../../apps/server/src/locations/infrastructure/adapters/driven/persistence/kysely-bookcase-spine-reader.adapter.js';
import { LibraryRows } from './library-rows.test-support.js';

afterEach(async () => {
    await LibraryRows.close();
});

async function furnished() {
    const current = await LibraryRows.open();
    const oak = await current.bookcase('Oak');

    return {
        current,
        oak,
        reader: new KyselyBookcaseSpineReader(current.connections),
    };
}

it('gives each shelf its books with category, authors and page count', async () => {
    const { current, oak, reader } = await furnished();
    const top = await current.shelf(oak, 'Top');

    const dune = await current.book({
        title: 'Dune',
        shelfId: top,
        author: 'Frank Herbert',
        pageCount: 612,
    });
    const akira = await current.book({ title: 'Akira', shelfId: top, category: 'manga' });

    const result = await reader.booksOn([top]);

    expect(Object.fromEntries(result)).toEqual({
        [top]: [
            { id: akira, title: 'Akira', authors: [], category: 'manga', pageCount: null },
            {
                id: dune,
                title: 'Dune',
                authors: ['Frank Herbert'],
                category: 'books',
                pageCount: 612,
            },
        ],
    });
});
it('orders a shelf with the volumes of a collection together at its name', async () => {
    const { current, oak, reader } = await furnished();
    const top = await current.shelf(oak, 'Top');
    const saga = await current.collection('Saga');

    await current.book({ title: 'Zeta', shelfId: top });
    await current.book({ title: 'Book Two', shelfId: top, collectionId: saga, volume: 2 });
    await current.book({ title: 'Alpha', shelfId: top });
    await current.book({ title: 'Book One', shelfId: top, collectionId: saga, volume: 1 });

    const result = await reader.booksOn([top]);

    expect(result.get(top)?.map((book) => book.title)).toEqual([
        'Alpha',
        'Book One',
        'Book Two',
        'Zeta',
    ]);
});
it('leaves out the books of shelves not asked for', async () => {
    const { current, oak, reader } = await furnished();
    const top = await current.shelf(oak, 'Top');
    const hall = await current.shelf(await current.bookcase('Hall'), 'Top');

    await current.book({ title: 'Dune', shelfId: top });
    await current.book({ title: 'Elsewhere', shelfId: hall });

    const result = await reader.booksOn([top]);

    expect([...result.keys()]).toEqual([top]);
});
it('gives nothing for an empty shelf', async () => {
    const { current, oak, reader } = await furnished();
    const empty = await current.shelf(oak, 'Empty');

    const result = await reader.booksOn([empty]);

    expect(result.size).toBe(0);
});
it('gives nothing when no shelf is asked for', async () => {
    const { reader } = await furnished();

    const result = await reader.booksOn([]);

    expect(result.size).toBe(0);
});
