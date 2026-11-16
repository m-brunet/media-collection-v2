import { describe, expect, it } from 'vitest';
import { ManualClock } from '../testing/book-doubles.test-support.js';
import { SourceCache } from './source-cache.service.js';

const day = 24 * 60 * 60;

function setup() {
    const clock = new ManualClock();

    return { clock, cache: new SourceCache<string>(clock) };
}

describe('SourceCache', () => {
    it('knows nothing about an answer it was never given', () => {
        const { cache } = setup();

        const kept = cache.read('9782253164692');

        expect(kept).toBeNull();
    });

    it('gives a found answer back with the date it was retrieved', () => {
        const { cache, clock } = setup();

        cache.keep('9782253164692', { kind: 'found', value: 'Piranesi' });
        clock.advance(3600);

        const kept = cache.read('9782253164692');

        expect(kept).toEqual({
            reply: { kind: 'found', value: 'Piranesi' },
            retrievedAt: new Date('2026-03-01T10:00:00Z'),
        });
    });

    it('keeps a found answer for seven days', () => {
        const { cache, clock } = setup();

        cache.keep('9782253164692', { kind: 'found', value: 'Piranesi' });
        clock.advance(7 * day - 1);

        const kept = cache.read('9782253164692');

        expect(kept?.reply).toEqual({ kind: 'found', value: 'Piranesi' });
    });

    it('forgets a found answer after seven days', () => {
        const { cache, clock } = setup();

        cache.keep('9782253164692', { kind: 'found', value: 'Piranesi' });
        clock.advance(7 * day);

        const kept = cache.read('9782253164692');

        expect(kept).toBeNull();
    });

    it('keeps a "not found" answer for one day', () => {
        const { cache, clock } = setup();

        cache.keep('9782253164692', { kind: 'none' });
        clock.advance(day - 1);

        const kept = cache.read('9782253164692');

        expect(kept?.reply).toEqual({ kind: 'none' });
    });

    it('forgets a "not found" answer after one day', () => {
        const { cache, clock } = setup();

        cache.keep('9782253164692', { kind: 'none' });
        clock.advance(day);

        const kept = cache.read('9782253164692');

        expect(kept).toBeNull();
    });

    it('drops the least recently used answer when it is full', () => {
        const { cache } = setup();

        for (let entry = 0; entry < SourceCache.maximumEntries; entry++) {
            cache.keep('isbn-' + entry, { kind: 'none' });
        }

        cache.read('isbn-0');

        cache.keep('one-more', { kind: 'none' });

        expect(cache.read('isbn-0')).not.toBeNull();
        expect(cache.read('isbn-1')).toBeNull();
        expect(cache.read('one-more')).not.toBeNull();
    });
});
