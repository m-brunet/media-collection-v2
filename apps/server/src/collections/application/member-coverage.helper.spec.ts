import { expect, it } from 'vitest';
import { MemberCoverage } from './member-coverage.helper.js';

it('turns saved memberships into coverage members', () => {
    const records = [
        {
            bookId: 'omnibus',
            collectionId: 'batman',
            volumeFrom: 1,
            volumeTo: 3,
            title: 'Batman omnibus',
            isbn: null,
            publisher: null,
            category: 'comics' as const,
            ownership: 'owned' as const,
            hasCover: false,
            updatedAt: '2026-01-01T00:00:00.000Z',
        },
    ];

    const members = MemberCoverage.of(records);

    expect(members).toEqual([
        {
            bookId: 'omnibus',
            ownership: 'owned',
            range: expect.objectContaining({ from: 1, to: 3 }),
        },
    ]);
});
