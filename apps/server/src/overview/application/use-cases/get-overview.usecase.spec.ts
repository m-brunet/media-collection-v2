import { describe, expect, it } from 'vitest';
import {
    guest,
    InMemoryLibrarySummary,
    otherOwner,
    owner,
    temporaryOwner,
} from '../testing/overview-doubles.test-support.js';
import { GetOverview } from './get-overview.usecase.js';

function library(): InMemoryLibrarySummary {
    return new InMemoryLibrarySummary()
        .add('Dune', '2026-01-01T10:00:00.000Z', ['camille'])
        .add('Emma', '2026-01-03T10:00:00.000Z')
        .add('Piranesi', '2026-01-02T10:00:00.000Z', ['sam']);
}

describe('GetOverview', () => {
    it('gives the shared counters', async () => {
        const summary = library();

        summary.counted = { ownedBooks: 0, collections: 2, bookcases: 1, shelves: 4, lentBooks: 1 };

        const overview = await new GetOverview(summary).execute(owner);

        expect(overview).toMatchObject({
            ownedBooks: 3,
            collections: 2,
            bookcases: 1,
            shelves: 4,
            lentBooks: 1,
        });
    });
    it('lists the recently added books newest first', async () => {
        const summary = library();

        const overview = await new GetOverview(summary).execute(owner);

        expect(overview.recentlyAdded.map((book) => book.title)).toEqual([
            'Emma',
            'Piranesi',
            'Dune',
        ]);
    });
    it('lists five recently added books at most', async () => {
        const summary = new InMemoryLibrarySummary();

        for (let day = 1; day <= 7; day++) {
            summary.add('Book ' + day, '2026-01-0' + day + 'T10:00:00.000Z');
        }

        const overview = await new GetOverview(summary).execute(owner);

        expect(overview.recentlyAdded.map((book) => book.title)).toEqual([
            'Book 7',
            'Book 6',
            'Book 5',
            'Book 4',
            'Book 3',
        ]);
    });
    it('shows an Owner their own reading on the recent books', async () => {
        const summary = library();

        const overview = await new GetOverview(summary).execute(owner);

        expect(overview.recentlyAdded.map((book) => [book.title, book.read])).toEqual([
            ['Emma', false],
            ['Piranesi', false],
            ['Dune', true],
        ]);
    });
    it('gives an Owner their own reading summary', async () => {
        const summary = library();

        const overview = await new GetOverview(summary).execute(owner);

        expect(overview.reading).toEqual({ read: 1, notRead: 2 });
    });
    it('does not count another account reading in the summary', async () => {
        const summary = library();

        const overview = await new GetOverview(summary).execute(otherOwner);

        expect(overview.reading).toEqual({ read: 1, notRead: 2 });
        expect(overview.recentlyAdded.find((book) => book.title === 'Dune')?.read).toBe(false);
    });
    it('gives a Guest no reading summary', async () => {
        const summary = library();

        const overview = await new GetOverview(summary).execute(guest);

        expect(overview.reading).toBeNull();
    });
    it('gives a Guest no reading status on the recent books', async () => {
        const summary = library();

        const overview = await new GetOverview(summary).execute(guest);

        expect(overview.recentlyAdded.map((book) => book.read)).toEqual([null, null, null]);
    });
    it('gives the bookcases with their shelf counts', async () => {
        const summary = library();

        summary.shelvedIn = [{ id: 'oak', name: 'Oak', shelfCount: 4 }];

        const overview = await new GetOverview(summary).execute(guest);

        expect(overview.bookcaseList).toEqual([{ id: 'oak', name: 'Oak', shelfCount: 4 }]);
    });
    it('refuses an account that must replace its temporary password', async () => {
        const summary = library();

        const reading = new GetOverview(summary).execute(temporaryOwner);

        await expect(reading).rejects.toMatchObject({ code: 'forbidden' });
    });
});
