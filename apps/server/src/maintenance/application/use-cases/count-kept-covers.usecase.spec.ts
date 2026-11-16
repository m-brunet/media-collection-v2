import { describe, expect, it } from 'vitest';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { CountKeptCovers } from './count-kept-covers.usecase.js';

function subject(count: number) {
    return new CountKeptCovers({ afterReset: async () => count });
}

describe('CountKeptCovers', () => {
    it('tells the Admin how many covers a reset would keep', async () => {
        const count = await subject(12).execute(TestActors.of('admin', 'admin'));

        expect(count).toBe(12);
    });

    it('refuses an Owner', async () => {
        const result = subject(12).execute(TestActors.of('owner', 'owner'));

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('refuses a Guest', async () => {
        const result = subject(12).execute(TestActors.of('guest', 'guest'));

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
});
