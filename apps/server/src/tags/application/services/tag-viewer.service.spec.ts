import { describe, expect, it } from 'vitest';
import { Tag } from '../../domain/entities/tag.entity.js';
import { TagViewer } from './tag-viewer.service.js';

const at = '2026-01-01T00:00:00.000Z';

describe('TagViewer', () => {
    it('shows a tag with the number of books carrying it', () => {
        const tag = new Tag({ id: 'fantasy', name: 'Fantasy', createdAt: at, updatedAt: at });

        const result = new TagViewer().view(tag, new Map([['fantasy', 86]]));

        expect(result).toEqual({ id: 'fantasy', name: 'Fantasy', bookCount: 86 });
    });
    it('shows an unused tag with no books', () => {
        const tag = new Tag({ id: 'explore', name: 'To explore', createdAt: at, updatedAt: at });

        const result = new TagViewer().view(tag, new Map());

        expect(result.bookCount).toBe(0);
    });
});
