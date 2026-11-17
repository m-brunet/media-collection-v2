import { describe, expect, it } from 'vitest';
import type { PublisherUsage } from '../../domain/value-objects/publisher-names.value-object.js';
import { PublisherMatcher } from './publisher-matcher.service.js';

function matcher(usages: PublisherUsage[]) {
    return new PublisherMatcher({ usages: async () => usages });
}

describe('PublisherMatcher', () => {
    it('saves a publisher of an existing key under the existing spelling', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = await publishers.resolve('glenat', false);

        expect(result).toBe('Glénat');
    });
    it('keeps a new publisher as typed, without its outer spaces', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = await publishers.resolve('  Kana ', false);

        expect(result).toBe('Kana');
    });
    it('saves no publisher for an empty one', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = await publishers.resolve('   ', false);

        expect(result).toBeNull();
    });
    it('asks before saving a spelling close to one existing publisher', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = publishers.resolve('Glénatt', false);

        await expect(result).rejects.toMatchObject({
            code: 'conflict',
            reason: 'publisher-similar',
            details: { name: 'Glénatt', candidates: ['Glénat'] },
        });
    });
    it('lists every close publisher in the question', async () => {
        const publishers = matcher([
            { name: 'Glénat', books: 2 },
            { name: 'Glématt', books: 1 },
        ]);

        const result = publishers.resolve('Glénatt', false);

        await expect(result).rejects.toMatchObject({
            details: { name: 'Glénatt', candidates: ['Glématt', 'Glénat'] },
        });
    });
    it('keeps a close spelling once confirmed as a different publisher', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = await publishers.resolve('Glénatt', true);

        expect(result).toBe('Glénatt');
    });
    it('applies the existing spelling without asking about close spellings', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = await publishers.existing('Glénatt');

        expect(result).toBe('Glénatt');
    });
    it('gives the existing spelling of the same key', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = await publishers.existing(' GLENAT');

        expect(result).toBe('Glénat');
    });
});
