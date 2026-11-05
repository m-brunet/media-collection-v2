import { describe, expect, it } from 'vitest';
import { BookFilter } from './book-filter.js';
import type { Actor } from '../domain/actor.helper.js';

const owner: Actor = {
    id: 'camille',
    username: 'camille',
    role: 'owner',
    mustChangePassword: false,
    language: null,
};
const guest: Actor = { ...owner, id: 'morgan', username: 'morgan', role: 'guest' };

describe('BookFilter', () => {
    it('keeps every book when nothing is chosen', () => {
        const filter = BookFilter.of();

        const result = filter.isEmpty();

        expect(result).toBe(true);
    });
    it('restricts the books once one field has a choice', () => {
        const filter = BookFilter.of({ tags: { include: [], exclude: ['medieval'] } });

        const result = filter.isEmpty();

        expect(result).toBe(false);
    });
    it('restricts the books with a No location choice', () => {
        const filter = BookFilter.of({
            locations: { bookcaseIds: [], shelfIds: [], none: true },
        });

        const result = filter.isEmpty();

        expect(result).toBe(false);
    });
    it('reports a reading status choice', () => {
        const filter = BookFilter.of({ reading: ['unread'] });

        const result = filter.usesReading();

        expect(result).toBe(true);
    });
    it('uses the reading status of a signed-in reader', () => {
        const filter = BookFilter.of({ reading: ['read'] });

        const result = filter.readerFor(owner);

        expect(result).toBe('camille');
    });
    it('reads no reading status for a Guest', () => {
        const filter = BookFilter.of();

        const result = filter.readerFor(guest);

        expect(result).toBeNull();
    });
    it('refuses a reading status filter for a Guest', () => {
        const filter = BookFilter.of({ reading: ['read'] });

        const result = () => filter.readerFor(guest);

        expect(result).toThrow(expect.objectContaining({ reason: 'reading-filter-unavailable' }));
    });
});
