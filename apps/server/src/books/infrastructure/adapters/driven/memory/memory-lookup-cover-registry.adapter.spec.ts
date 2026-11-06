import { describe, expect, it } from 'vitest';
import { MemoryLookupCoverRegistry } from './memory-lookup-cover-registry.adapter.js';

function clock() {
    let now = new Date('2026-11-06T10:00:00Z');

    return {
        now: () => now,
        advance: (minutes: number) => {
            now = new Date(now.getTime() + minutes * 60_000);
        },
    };
}

describe('MemoryLookupCoverRegistry', () => {
    it('gives the address behind a token', () => {
        const registry = new MemoryLookupCoverRegistry(clock());
        const token = registry.register('https://covers.example/1-L.jpg');

        const address = registry.address(token);

        expect(address).toBe('https://covers.example/1-L.jpg');
    });

    it('issues tokens that reveal nothing about the address', () => {
        const registry = new MemoryLookupCoverRegistry(clock());

        const token = registry.register('https://covers.example/1-L.jpg');

        expect(token).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('forgets a cover after half an hour', () => {
        const time = clock();
        const registry = new MemoryLookupCoverRegistry(time);
        const token = registry.register('https://covers.example/1-L.jpg');

        time.advance(MemoryLookupCoverRegistry.keptMinutes);

        expect(registry.address(token)).toBeNull();
    });

    it('knows no token it did not issue', () => {
        const registry = new MemoryLookupCoverRegistry(clock());

        const address = registry.address('00000000-0000-4000-8000-000000000000');

        expect(address).toBeNull();
    });
});
