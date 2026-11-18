import { describe, expect, it } from 'vitest';
import { Collection } from '../domain/entities/collection.entity.js';
import { CollectionSnapshot } from './collection-snapshot.helper.js';

describe('CollectionSnapshot', () => {
    it('records the collection settings in plain values', () => {
        const collection = new Collection({
            id: 'c1',
            name: 'Batman',
            category: 'comics',
            includesVolumeZero: true,
            status: 'unfinished',
            lastVolume: 15,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });

        const result = CollectionSnapshot.of(collection);

        expect(result).toEqual({
            name: 'Batman',
            category: 'comics',
            includesVolumeZero: true,
            status: 'unfinished',
            lastVolume: 15,
        });
    });
});
