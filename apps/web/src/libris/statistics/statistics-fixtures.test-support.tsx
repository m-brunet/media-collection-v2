import { screen } from '@testing-library/react';
import type { StatisticsDto } from '../../../../../packages/contracts/src/http';
import { Required } from '../../shared/required.util';
import { account, FakeApi } from '../../testing/fake-api.test-support';
import { renderRoute } from '../../testing/render-route.test-support';
import { StatisticsPage } from './statistics-page';

export function statistics(overrides: Partial<StatisticsDto> = {}): StatisticsDto {
    return {
        ownedBooks: 4500,
        singleBooks: 61,
        categories: { books: 85, manga: 268, comics: 97 },
        categoryPages: {
            books: { pages: 30100, known: 80 },
            manga: { pages: 51200, known: 260 },
            comics: { pages: 15120, known: 72 },
        },
        reading: { read: 312, notRead: 138, pages: { read: 61200, notRead: 25300, known: 401 } },
        pages: { total: 96420, known: 412 },
        price: { totalCents: 328450, known: 398 },
        publishers: {
            byBooks: [
                { name: 'Glénat', books: 96, pages: 18000 },
                { name: 'Kana', books: 61, pages: 21000 },
            ],
            byPages: [
                { name: 'Kana', books: 61, pages: 21000 },
                { name: 'Glénat', books: 96, pages: 18000 },
            ],
            without: 22,
            count: 2,
        },
        authors: {
            byBooks: [{ name: 'Eiichiro Oda', books: 62, pages: 11780 }],
            byPages: [{ name: 'Eiichiro Oda', books: 62, pages: 11780 }],
        },
        records: {
            longest: { id: 'b1', title: 'Les Misérables', authors: ['Victor Hugo'], value: 1664 },
            mostExpensive: { id: 'b2', title: 'Akira', authors: ['Katsuhiro Otomo'], value: 14900 },
            biggestCollection: { id: 'c1', name: 'One Piece', ownedBooks: 62 },
        },
        collections: { finished: 14, unfinished: 24, dropped: 0, missingVolumes: 187 },
        ...overrides,
    };
}

export function library(body: StatisticsDto = statistics(), role: 'owner' | 'guest' = 'owner') {
    return new FakeApi()
        .signedIn(account({ role }))
        .on('GET /statistics', () => ({ status: 200, body }));
}

export function show(path = '/statistics') {
    return renderRoute(path, { '/statistics': <StatisticsPage /> });
}

export function card(name: string) {
    return Required.value(
        screen.getByRole('heading', { name }).closest('section'),
        'each statistic is a section under its heading',
    );
}
