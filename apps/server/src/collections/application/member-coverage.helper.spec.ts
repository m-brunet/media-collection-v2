import { describe, expect, it } from 'vitest';
import { MemberCoverage } from './member-coverage.helper.js';

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

describe('MemberCoverage', () => {
    it('turns saved memberships into coverage members', () => {
        const members = MemberCoverage.of(records);

        expect(members).toEqual([
            {
                bookId: 'omnibus',
                ownership: 'owned',
                range: expect.objectContaining({ from: 1, to: 3 }),
            },
        ]);
    });
    it('adds the title and category for the shopping view', () => {
        const members = MemberCoverage.forShopping(records);

        expect(members).toEqual([
            {
                bookId: 'omnibus',
                ownership: 'owned',
                range: expect.objectContaining({ from: 1, to: 3 }),
                title: 'Batman omnibus',
                category: 'comics',
            },
        ]);
    });
});
