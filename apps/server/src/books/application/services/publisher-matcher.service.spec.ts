import { describe, expect, it } from 'vitest';
import type { PublisherUsage } from '../../domain/value-objects/publisher-names.value-object.js';
import { PublisherMatcher } from './publisher-matcher.service.js';

function matcher(usages: PublisherUsage[]) {
    return new PublisherMatcher({ usages: async () => usages });
}

describe('PublisherMatcher', () => {
    it('saves an existing publisher typed exactly', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = await publishers.resolve(' Glénat ', false);

        expect(result).toBe('Glénat');
    });
    it('asks before saving another case or accents of an existing publisher', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = publishers.resolve('glenat', false);

        await expect(result).rejects.toMatchObject({
            reason: 'publisher-similar',
            details: { name: 'glenat', candidates: ['Glénat'] },
        });
    });
    it('saves another case of an existing publisher as typed once confirmed', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = await publishers.resolve('glenat', true);

        expect(result).toBe('glenat');
    });
    it('does not ask about the spelling only the edited book uses', async () => {
        const publishers = matcher([{ name: 'glenat', books: 1 }]);

        const result = await publishers.resolve('Glénat', false, 'glenat');

        expect(result).toBe('Glénat');
    });
    it('asks about the spelling the edited book shares with other books', async () => {
        const publishers = matcher([{ name: 'glenat', books: 2 }]);

        const result = publishers.resolve('Glénat', false, 'glenat');

        await expect(result).rejects.toMatchObject({
            details: { name: 'Glénat', candidates: ['glenat'] },
        });
    });
    it('does not ask about a publisher the edited book keeps', async () => {
        const publishers = matcher([
            { name: 'Glénat', books: 2 },
            { name: 'Glénatt', books: 1 },
        ]);

        const result = await publishers.resolve('Glénatt', false, 'Glénatt');

        expect(result).toBe('Glénatt');
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
    it('keeps a close spelling as typed once confirmed', async () => {
        const publishers = matcher([{ name: 'Glénat', books: 2 }]);

        const result = await publishers.resolve('Glénatt', true);

        expect(result).toBe('Glénatt');
    });
});
