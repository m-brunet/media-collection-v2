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

it('follows the refusal of the server over older information', () => {
    const found = book({ refusal: { kind: 'gone' } });

    const result = LendingChoice.availability(found, []);

    expect(result).toBe('gone');
});

it('names who has a book refused as already lent', () => {
    const found = book({ loan, refusal: { kind: 'lent', receiverName: 'Sam Taylor' } });

    const result = LendingChoice.lentTo(found);

    expect(result).toBe('Sam Taylor');
});

it('names who has a book known to be lent', () => {
    const found = book({ loan });

    const result = LendingChoice.lentTo(found);

    expect(result).toBe('Morgan');
});

it('marks the books refused as already lent with their receiver, keeping the order', () => {
    const selected = [book({ id: 'piranesi', title: 'Piranesi' }), book()];

    const result = LendingChoice.refused(selected, 'book-already-lent', {
        bookIds: ['dune'],
        lentTo: { dune: 'Morgan' },
    });

    expect(result.map((value) => [value.id, value.refusal ?? null])).toEqual([
        ['piranesi', null],
        ['dune', { kind: 'lent', receiverName: 'Morgan' }],
    ]);
});

it('marks the books refused as Not Owned', () => {
    const selected = [book()];

    const result = LendingChoice.refused(selected, 'book-not-owned', { bookIds: ['dune'] });

    expect(result[0]!.refusal).toEqual({ kind: 'not-owned' });
});

it('marks the books that no longer exist', () => {
    const selected = [book()];

    const result = LendingChoice.refused(selected, 'book-missing', { bookIds: ['dune'] });

    expect(result[0]!.refusal).toEqual({ kind: 'gone' });
});

it('leaves the selection unchanged for another refusal', () => {
    const selected = [book()];

    const result = LendingChoice.refused(selected, 'receiver-name-invalid', null);

    expect(result).toEqual(selected);
});
