import { expect, it } from 'vitest';
import { LoanLinks } from './loan-links.util';

it('opens the lending page with the starting book', () => {
    const bookId = 'b1';

    const result = LoanLinks.lend(bookId);

    expect(result).toBe('/loans/lend?book=b1');
});

it('opens the returns of a receiver with the starting loan', () => {
    const receiverId = 'r1';

    const result = LoanLinks.returns(receiverId, 'l1');

    expect(result).toBe('/loans/return?receiver=r1&loan=l1');
});

it('encodes identities placed in the address', () => {
    const bookId = 'a b&c';

    const result = LoanLinks.lend(bookId);

    expect(result).toBe('/loans/lend?book=a%20b%26c');
});
