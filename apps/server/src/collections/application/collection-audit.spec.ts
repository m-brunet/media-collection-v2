import { describe, expect, it } from 'vitest';
import { Collection } from '../domain/entities/collection.entity.js';
import { CollectionChange, CollectionSnapshot } from './collection-audit.js';

const batman = () =>
    new Collection({
        id: 'c1',
        name: 'Batman',
        includesVolumeZero: false,
        finished: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    });

describe('CollectionChange', () => {
    it('describes a collection that came into existence', () => {
        const collection = batman();

        const result = CollectionChange.of('collection.created', 'c1', null, collection);

        expect(result).toEqual({
            category: 'collection.created',
            subjectType: 'collection',
            subjectId: 'c1',
            before: null,
            after: { name: 'Batman', includesVolumeZero: false, finished: false },
        });
    });
    it('describes a collection that no longer exists', () => {
        const collection = batman();

        const result = CollectionChange.of('collection.removed', 'c1', collection, null);

        expect(result).toMatchObject({
            before: { name: 'Batman', includesVolumeZero: false, finished: false },
            after: null,
        });
    });
});

describe('CollectionSnapshot', () => {
    it('records the collection settings in plain values', () => {
        const collection = new Collection({
            id: 'c1',
            name: 'Batman',
            includesVolumeZero: true,
            finished: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });

        const result = CollectionSnapshot.of(collection);

        expect(result).toEqual({ name: 'Batman', includesVolumeZero: true, finished: false });
    });
});
