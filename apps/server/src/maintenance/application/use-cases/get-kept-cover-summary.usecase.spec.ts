import { describe, expect, it } from 'vitest';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { GetKeptCoverSummary } from './get-kept-cover-summary.usecase.js';

const summary = { count: 437, bytes: 54_525_952, oldestKeptAt: '2026-03-12T09:00:00.000Z' };

function subject() {
    return new GetKeptCoverSummary({ summary: async () => summary, deleteAll: async () => 0 });
}

describe('GetKeptCoverSummary', () => {
    it('tells the Admin how many covers are kept, their size and the oldest date', async () => {
        const result = await subject().execute(TestActors.of('admin', 'admin'));

        expect(result).toEqual(summary);
    });

    it('refuses an Owner', async () => {
        const result = subject().execute(TestActors.of('owner', 'owner'));

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('refuses a Guest', async () => {
        const result = subject().execute(TestActors.of('guest', 'guest'));

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
});
