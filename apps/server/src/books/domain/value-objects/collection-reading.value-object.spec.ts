import { expect, it } from 'vitest';
import { CollectionReading } from './collection-reading.value-object.js';

it('is read when every owned book is read', () => {
    const readIds = new Set(['one', 'two']);

    const result = CollectionReading.of(['one', 'two'], readIds);

    expect(result.view).toEqual({ read: true, ownedCount: 2 });
});

it('is not read while one owned book is unread', () => {
    const readIds = new Set(['one']);

    const result = CollectionReading.of(['one', 'two'], readIds);

    expect(result.view).toEqual({ read: false, ownedCount: 2 });
});

it('is not read when the collection has no owned book', () => {
    const readIds = new Set<string>();

    const result = CollectionReading.of([], readIds);

    expect(result.view).toEqual({ read: false, ownedCount: 0 });
});

it('ignores read books that are not owned books of the collection', () => {
    const readIds = new Set(['one', 'elsewhere']);

    const result = CollectionReading.of(['one', 'two'], readIds);

    expect(result.view).toEqual({ read: false, ownedCount: 2 });
});

it('counts a book listed twice once', () => {
    const readIds = new Set(['one']);

    const result = CollectionReading.of(['one', 'one'], readIds);

    expect(result.view).toEqual({ read: true, ownedCount: 1 });
});

it('marks as read only the owned books still unread', () => {
    const reading = CollectionReading.of(['one', 'two', 'three'], new Set(['two']));

    const result = reading.booksToMark(true);

    expect(result).toEqual(['one', 'three']);
});

it('marks as not read only the owned books currently read', () => {
    const reading = CollectionReading.of(['one', 'two', 'three'], new Set(['two']));

    const result = reading.booksToMark(false);

    expect(result).toEqual(['two']);
});

it('becomes read once every owned book is marked read', () => {
    const reading = CollectionReading.of(['one', 'two'], new Set(['two']));

    const result = reading.marked(true);

    expect(result.view).toEqual({ read: true, ownedCount: 2 });
});

it('becomes not read once every owned book is marked not read', () => {
    const reading = CollectionReading.of(['one', 'two'], new Set(['one', 'two']));

    const result = reading.marked(false);

    expect(result.view).toEqual({ read: false, ownedCount: 2 });
    expect(result.booksToMark(true)).toEqual(['one', 'two']);
});
