import { describe, expect, it } from 'vitest';
import type { CoverOffer } from './cover-combination.service.js';
import { CoverCombination } from './cover-combination.service.js';

function offer(overrides: Partial<CoverOffer> = {}): CoverOffer {
    return { address: 'https://a/1.jpg', width: 400, height: 600, fingerprint: null, ...overrides };
}

describe('CoverCombination', () => {
    it('offers the covers in order of preference', () => {
        const combination = new CoverCombination();

        combination.add('openlibrary', [offer({ address: 'https://ol/1.jpg' })]);
        combination.add('google', [offer({ address: 'https://g/1.jpg' })]);

        expect(combination.result().map((cover) => cover.address)).toEqual([
            'https://ol/1.jpg',
            'https://g/1.jpg',
        ]);
    });

    it('leaves out thumbnails too small to make a cover', () => {
        const combination = new CoverCombination();

        combination.add('google', [offer({ width: 128, height: 192 })]);

        expect(combination.result()).toEqual([]);
    });

    it('keeps a cover whose size is unknown', () => {
        const combination = new CoverCombination();

        combination.add('openlibrary', [offer({ width: null, height: null })]);

        expect(combination.result()).toHaveLength(1);
    });

    it('shows the same picture once, at its best resolution, where it first appeared', () => {
        const combination = new CoverCombination();

        combination.add('openlibrary', [
            offer({ address: 'https://ol/small.jpg', width: 300, height: 450, fingerprint: 'f1' }),
            offer({ address: 'https://ol/other.jpg', fingerprint: 'f2' }),
        ]);
        combination.add('google', [
            offer({ address: 'https://g/large.jpg', width: 800, height: 1200, fingerprint: 'f1' }),
        ]);

        expect(combination.result()).toEqual([
            {
                address: 'https://g/large.jpg',
                width: 800,
                height: 1200,
                sources: ['openlibrary', 'google'],
            },
            { address: 'https://ol/other.jpg', width: 400, height: 600, sources: ['openlibrary'] },
        ]);
    });
});
