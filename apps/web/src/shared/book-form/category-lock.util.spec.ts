import { describe, expect, it } from 'vitest';
import type { BookDto, CollectionNameDto } from '../../../../../packages/contracts/src/http';
import { BookDraft } from './book-draft.util';
import { CategoryLock } from './category-lock.util';

const allYouNeed: CollectionNameDto = {
    id: 'aynik',
    name: 'All You Need Is Kill',
    category: 'manga',
    includesVolumeZero: false,
};

function member(): BookDto {
    return {
        category: 'manga',
        collection: { id: 'naruto', name: 'Naruto', volumeFrom: 3, volumeTo: 3 },
    } as BookDto;
}

describe('CategoryLock.of', () => {
    it('locks the category to an existing collection of the same name', () => {
        const values = BookDraft.inCollection('all you need is kill');

        const result = CategoryLock.of(null, values, [allYouNeed]);

        expect(result).toEqual({ kind: 'locked', collection: allYouNeed });
    });

    it('leaves the category free for a new collection name', () => {
        const values = BookDraft.inCollection('All You Need');

        const result = CategoryLock.of(null, values, [allYouNeed]);

        expect(result).toEqual({ kind: 'free' });
    });

    it('leaves the category free outside a collection', () => {
        const values = { ...BookDraft.inCollection('All You Need Is Kill'), inCollection: false };

        const result = CategoryLock.of(null, values, [allYouNeed]);

        expect(result).toEqual({ kind: 'free' });
    });

    it('leaves the category of a member book open to a whole-collection change', () => {
        const values = BookDraft.inCollection('Naruto');
        const naruto = { ...allYouNeed, id: 'naruto', name: 'Naruto' };

        const result = CategoryLock.of(member(), values, [naruto]);

        expect(result).toEqual({ kind: 'member', name: 'Naruto' });
    });

    it('locks a member book moving to another existing collection', () => {
        const values = BookDraft.inCollection('All You Need Is Kill');

        const result = CategoryLock.of(member(), values, [allYouNeed]);

        expect(result).toEqual({ kind: 'locked', collection: allYouNeed });
    });
});
