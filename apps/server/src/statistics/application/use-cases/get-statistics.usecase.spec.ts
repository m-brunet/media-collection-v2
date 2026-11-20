import { describe, expect, it } from 'vitest';
import {
    FixedCollectionTallies,
    FixedLibraryStatistics,
    StatisticsActors,
} from '../testing/statistics-doubles.test-support.js';
import { GetStatistics } from './get-statistics.usecase.js';

function statistics(
    library = new FixedLibraryStatistics(),
    collections = new FixedCollectionTallies(),
) {
    return { library, collections, use: new GetStatistics(library, collections) };
}

describe('GetStatistics', () => {
    it('gives the book totals of the library', async () => {
        const { library, use } = statistics();

        library.counted = {
            ownedBooks: 450,
            singleBooks: 61,
            pages: { total: 96420, known: 412 },
            price: { totalCents: 328450, known: 398 },
        };

        const view = await use.execute(StatisticsActors.owner, null);

        expect(view).toMatchObject(library.counted);
    });
    it('reads the numbers of the chosen category', async () => {
        const { library, use } = statistics();

        await use.execute(StatisticsActors.owner, 'manga');

        expect(library.asked).toEqual(['manga']);
    });
    it('always gives the three categories', async () => {
        const { library, use } = statistics();

        library.split = { books: 85, manga: 268, comics: 97 };

        const view = await use.execute(StatisticsActors.owner, 'manga');

        expect(view.categories).toEqual({ books: 85, manga: 268, comics: 97 });
    });
    it('always gives the pages of the three categories', async () => {
        const { library, use } = statistics();

        library.paged = {
            books: { pages: 30100, known: 80 },
            manga: { pages: 51200, known: 260 },
            comics: { pages: 15120, known: 72 },
        };

        const view = await use.execute(StatisticsActors.owner, 'manga');

        expect(view.categoryPages).toEqual(library.paged);
    });
    it('gives an Owner their own reading', async () => {
        const { library, use } = statistics();

        library.read = {
            read: 312,
            notRead: 138,
            pages: { read: 61200, notRead: 25300, known: 401 },
        };

        const view = await use.execute(StatisticsActors.owner, null);

        expect([view.reading, library.readers]).toEqual([library.read, ['camille']]);
    });
    it('gives a Guest no reading', async () => {
        const { use } = statistics();

        const view = await use.execute(StatisticsActors.guest, null);

        expect(view.reading).toBeNull();
    });
    it('refuses an account that must replace its temporary password', async () => {
        const { use } = statistics();

        const result = use.execute(StatisticsActors.temporaryOwner, null);

        await expect(result).rejects.toMatchObject({ reason: 'temporary-password' });
    });
    it('ranks ten publishers by books, equal numbers by name', async () => {
        const { library, use } = statistics();

        library.published = {
            counts: [
                { name: 'Pika', books: 5, pages: 900 },
                ...Array.from({ length: 10 }, (_, index) => ({
                    name: 'Publisher ' + String.fromCharCode(74 - index),
                    books: 5,
                    pages: 100,
                })),
            ],
            without: 0,
        };

        const view = await use.execute(StatisticsActors.owner, null);

        expect(view.publishers.byBooks.map((publisher) => publisher.name)).toEqual([
            'Pika',
            'Publisher A',
            'Publisher B',
            'Publisher C',
            'Publisher D',
            'Publisher E',
            'Publisher F',
            'Publisher G',
            'Publisher H',
            'Publisher I',
        ]);
    });
    it('ranks publishers by pages, leaving out those without a page count', async () => {
        const { library, use } = statistics();

        library.published = {
            counts: [
                { name: 'Glénat', books: 9, pages: 1200 },
                { name: 'Kana', books: 3, pages: 2400 },
                { name: 'Pika', books: 2, pages: 0 },
            ],
            without: 0,
        };

        const view = await use.execute(StatisticsActors.owner, null);

        expect(view.publishers.byPages.map((publisher) => publisher.name)).toEqual([
            'Kana',
            'Glénat',
        ]);
    });
    it('counts the publishers and the books without one', async () => {
        const { library, use } = statistics();

        library.published = {
            counts: [
                { name: 'Glénat', books: 9, pages: 1200 },
                { name: 'Kana', books: 3, pages: 2400 },
            ],
            without: 22,
        };

        const view = await use.execute(StatisticsActors.owner, null);

        expect([view.publishers.count, view.publishers.without]).toEqual([2, 22]);
    });
    it('ranks ten authors by books', async () => {
        const { library, use } = statistics();

        library.written = Array.from({ length: 12 }, (_, index) => ({
            name: 'Author ' + index,
            books: index,
            pages: 0,
        }));

        const view = await use.execute(StatisticsActors.owner, null);

        expect(view.authors.byBooks.map((author) => author.books)).toEqual([
            11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
        ]);
    });
    it('ranks authors by pages, leaving out those without a page count', async () => {
        const { library, use } = statistics();

        library.written = [
            { name: 'Eiichiro Oda', books: 62, pages: 1200 },
            { name: 'Victor Hugo', books: 1, pages: 1664 },
            { name: 'Hergé', books: 23, pages: 0 },
        ];

        const view = await use.execute(StatisticsActors.owner, null);

        expect(view.authors.byPages.map((author) => author.name)).toEqual([
            'Victor Hugo',
            'Eiichiro Oda',
        ]);
    });
    it('gives the longest and the most expensive books', async () => {
        const { library, use } = statistics();

        library.longestBook = { id: 'b1', title: 'Les Misérables', authors: [], value: 1664 };
        library.dearestBook = { id: 'b2', title: 'Akira', authors: [], value: 14900 };

        const view = await use.execute(StatisticsActors.owner, null);

        expect([view.records.longest?.title, view.records.mostExpensive?.title]).toEqual([
            'Les Misérables',
            'Akira',
        ]);
    });
    it('counts the collections of the chosen category', async () => {
        const collections = new FixedCollectionTallies()
            .add('One Piece', { status: 'finished', missingVolumes: 0 })
            .add('Naruto', { missingVolumes: 3 })
            .add('Asterix', { category: 'comics', missingVolumes: 5 });
        const { use } = statistics(undefined, collections);

        const view = await use.execute(StatisticsActors.owner, 'manga');

        expect(view.collections).toEqual({
            finished: 1,
            unfinished: 1,
            dropped: 0,
            missingVolumes: 3,
        });
    });
    it('counts the dropped collections apart from the unfinished ones', async () => {
        const collections = new FixedCollectionTallies()
            .add('Naruto', { missingVolumes: 3 })
            .add('Bleach', { status: 'dropped', missingVolumes: 40 });
        const { use } = statistics(undefined, collections);

        const view = await use.execute(StatisticsActors.owner, null);

        expect(view.collections).toEqual({
            finished: 0,
            unfinished: 1,
            dropped: 1,
            missingVolumes: 3,
        });
    });
    it('gives the collection with the most owned books, equal numbers by name', async () => {
        const collections = new FixedCollectionTallies()
            .add('Naruto', { ownedBooks: 62 })
            .add('Bleach', { ownedBooks: 62 })
            .add('Asterix', { ownedBooks: 80, category: 'comics' });
        const { use } = statistics(undefined, collections);

        const view = await use.execute(StatisticsActors.owner, 'manga');

        expect(view.records.biggestCollection).toEqual({
            id: 'collection-bleach',
            name: 'Bleach',
            ownedBooks: 62,
        });
    });
    it('gives no biggest collection when no collection holds an owned book', async () => {
        const collections = new FixedCollectionTallies().add('Naruto', { ownedBooks: 0 });
        const { use } = statistics(undefined, collections);

        const view = await use.execute(StatisticsActors.owner, null);

        expect(view.records.biggestCollection).toBeNull();
    });
});
