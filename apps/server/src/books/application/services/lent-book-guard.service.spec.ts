import { expect, it } from 'vitest';
import { MemoryLoans } from '../testing/book-doubles.test-support.js';
import { LentBookGuard } from './lent-book-guard.service.js';

it('lets a book that is not lent through', async () => {
    const guard = new LentBookGuard(new MemoryLoans());

    const result = guard.ensureNotLent('dune');

    await expect(result).resolves.toBeUndefined();
});

it('refuses a lent book, naming its receiver', async () => {
    const loans = new MemoryLoans();

    loans.lend('dune', 'Sam Taylor');

    const result = new LentBookGuard(loans).ensureNotLent('dune');

    await expect(result).rejects.toMatchObject({
        code: 'conflict',
        reason: 'book-lent',
        details: { receiverName: 'Sam Taylor' },
    });
});

it('lets a book through once its loan is no longer active', async () => {
    const loans = new MemoryLoans();

    loans.lend('dune');
    loans.active.delete('dune');

    const result = new LentBookGuard(loans).ensureNotLent('dune');

    await expect(result).resolves.toBeUndefined();
});
