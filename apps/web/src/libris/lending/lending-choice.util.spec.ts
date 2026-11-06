import { expect, it } from 'vitest';
import type { LendingBook } from './lending-choice.util';
import { LendingChoice } from './lending-choice.util';

const book = (overrides: Partial<LendingBook> = {}): LendingBook => ({
    id: 'dune',
    title: 'Dune',
    authors: ['Frank Herbert'],
    edition: null,
    ownership: 'owned',
    loan: null,
    ...overrides,
});

const loan = {
    id: 'l1',
    receiverId: 'r1',
    receiverName: 'Morgan',
    lentAt: '2026-10-01T09:00:00.000Z',
};

it('offers an Owned book that is not lent', () => {
    const found = book();

    const result = LendingChoice.availability(found, []);

    expect(result).toBe('available');
});

it('marks a book already in the selection', () => {
    const found = book();

    const result = LendingChoice.availability(found, [book()]);

    expect(result).toBe('selected');
});

it('refuses a Not Owned book', () => {
    const found = book({ ownership: 'not-owned' });

    const result = LendingChoice.availability(found, []);

    expect(result).toBe('not-owned');
});

it('refuses a book already lent', () => {
    const found = book({ loan });

    const result = LendingChoice.availability(found, []);

    expect(result).toBe('lent');
});

it('reports a book the server no longer has', () => {
    const found = book({ gone: true });

    const result = LendingChoice.availability(found, []);

    expect(result).toBe('gone');
});

it('applies fresh information to the selection, keeping its order', () => {
    const selected = [book({ id: 'piranesi', title: 'Piranesi' }), book()];

    const result = LendingChoice.refreshed(selected, [book({ loan })]);

    expect(result.map((value) => [value.id, value.loan?.receiverName ?? null])).toEqual([
        ['piranesi', null],
        ['dune', 'Morgan'],
    ]);
});
