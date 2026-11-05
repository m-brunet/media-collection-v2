import { describe, expect, it } from 'vitest';
import { Tag } from '../domain/entities/tag.entity.js';
import { TagSnapshot } from './tag-audit.js';

const at = '2026-01-01T00:00:00.000Z';
const fantasy = () => new Tag({ id: 'fantasy', name: 'Fantasy', createdAt: at, updatedAt: at });

describe('TagSnapshot', () => {
    it('records a tag by its name', () => {
        const tag = fantasy();

        const result = TagSnapshot.of(tag);

        expect(result).toEqual({ name: 'Fantasy' });
    });
    it('describes a tag created by another operation', () => {
        const tag = fantasy();

        const result = TagSnapshot.created(tag);

        expect(result).toEqual({
            category: 'tag.created',
            subjectType: 'tag',
            subjectId: 'fantasy',
            before: null,
            after: { name: 'Fantasy' },
        });
    });
});
