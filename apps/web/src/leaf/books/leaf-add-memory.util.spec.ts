import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { bookDto } from '../../testing/book-fixtures.test-support';
import { LeafAddMemory } from './leaf-add-memory.util';

afterEach(() => {
    vi.unstubAllGlobals();
});

// The browser storage, or one that refuses every access (private window, blocked site data).
function storage(available = true) {
    const values = new Map<string, string>();
    const refuse = () => {
        throw new Error('SecurityError');
    };

    vi.stubGlobal('window', {
        localStorage: {
            getItem: available ? (key: string) => values.get(key) ?? null : refuse,
            setItem: available ? (key: string, value: string) => values.set(key, value) : refuse,
        },
    });

    return values;
}

beforeEach(() => {
    storage();
});

const placed = bookDto({
    category: 'manga',
    personal: { read: true, note: null },
    location: { bookcaseId: 'salon', bookcaseName: 'Salon', shelfId: 'top', shelfName: 'Top' },
});

const bookcases: BookcaseDto[] = [
    {
        id: 'salon',
        name: 'Salon',
        bookCount: 0,
        shelves: [{ id: 'top', bookcaseId: 'salon', name: 'Top', bookCount: 0 }],
    },
];

it('remembers the saved book’s shelf, category and reading status', () => {
    LeafAddMemory.write('alex', placed);

    const result = LeafAddMemory.read('alex');

    expect(result).toEqual({ category: 'manga', read: true, bookcaseId: 'salon', shelfId: 'top' });
});

it('remembers a book without a shelf', () => {
    LeafAddMemory.write('alex', bookDto({ category: 'comics', location: null }));

    const result = LeafAddMemory.read('alex');

    expect(result).toEqual({ category: 'comics', read: false, bookcaseId: null, shelfId: null });
});

it('keeps each account’s choices apart', () => {
    LeafAddMemory.write('alex', placed);

    const result = LeafAddMemory.read('sam');

    expect(result).toBeNull();
});

it('ignores an unreadable stored value', () => {
    storage().set('media-collection.leaf.last-add.alex', '{"category":"poems"}');

    const result = LeafAddMemory.read('alex');

    expect(result).toBeNull();
});

it('reads nothing when the storage is unavailable', () => {
    storage(false);

    const result = LeafAddMemory.read('alex');

    expect(result).toBeNull();
});

it('saves nothing, without failing, when the storage is unavailable', () => {
    storage(false);

    const write = () => LeafAddMemory.write('alex', placed);

    expect(write).not.toThrow();
});

it('keeps a shelf that still exists', () => {
    const values = { bookcaseId: 'salon', shelfId: 'top' };

    const result = LeafAddMemory.located(values, bookcases);

    expect(result).toEqual({ bookcaseId: 'salon', shelfId: 'top' });
});

it('drops a shelf deleted since it was remembered', () => {
    const values = { bookcaseId: 'salon', shelfId: 'gone' };

    const result = LeafAddMemory.located(values, bookcases);

    expect(result).toEqual({ bookcaseId: null, shelfId: null });
});

it('drops the shelf of a deleted bookcase', () => {
    const values = { bookcaseId: 'study', shelfId: 'top' };

    const result = LeafAddMemory.located(values, bookcases);

    expect(result).toEqual({ bookcaseId: null, shelfId: null });
});
