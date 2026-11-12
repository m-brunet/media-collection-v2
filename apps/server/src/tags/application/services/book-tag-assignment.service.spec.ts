import { describe, expect, it } from 'vitest';
import { TagDoubles } from '../testing/tag-doubles.test-support.js';

describe('BookTagAssignment', () => {
    it('creates the tags of new names and reports them', async () => {
        const current = TagDoubles.labels();

        const result = await current.assignment.assign('dune', [{ name: 'Science fiction' }]);

        expect(result.tags).toEqual([{ id: 'tag-1', name: 'Science fiction' }]);
        expect(result.changes).toEqual([
            {
                category: 'tag.created',
                subjectType: 'tag',
                subjectId: 'tag-1',
                before: null,
                after: { name: 'Science fiction' },
            },
        ]);
    });
    it('reuses the tag of an equivalent name, keeping its label', async () => {
        const current = TagDoubles.labels();
        const tag = await TagDoubles.tagged(current, 'Médiéval');

        const result = await current.assignment.assign('dune', [{ name: ' medieval ' }]);

        expect(result.tags).toEqual([{ id: tag.id, name: 'Médiéval' }]);
        expect(result.changes).toEqual([]);
        expect(current.tags.tags.size).toBe(1);
    });
    it('replaces the tags of a book, ordered by name', async () => {
        const current = TagDoubles.labels();
        const fantasy = await TagDoubles.tagged(current, 'Fantasy');
        const adventure = await TagDoubles.tagged(current, 'Adventure');

        await current.assignment.assign('dune', [{ id: fantasy.id }]);

        const result = await current.assignment.assign('dune', [
            { id: fantasy.id },
            { id: adventure.id },
        ]);

        expect(result.tags.map((tag) => tag.name)).toEqual(['Adventure', 'Fantasy']);
        expect(current.store.links.get('dune')).toEqual([fantasy.id, adventure.id]);
    });
    it('keeps a tag once when it is chosen twice', async () => {
        const current = TagDoubles.labels();
        const fantasy = await TagDoubles.tagged(current, 'Fantasy');

        const result = await current.assignment.assign('dune', [
            { id: fantasy.id },
            { name: 'FANTASY' },
        ]);

        expect(result.tags).toEqual([{ id: fantasy.id, name: 'Fantasy' }]);
    });
    it('removes every tag of a book, keeping the unused tags', async () => {
        const current = TagDoubles.labels();
        const fantasy = await TagDoubles.tagged(current, 'Fantasy');

        await current.assignment.assign('dune', [{ id: fantasy.id }]);

        const result = await current.assignment.assign('dune', []);

        expect(result.tags).toEqual([]);
        expect(current.tags.tags.size).toBe(1);
    });
    it('refuses an unknown tag', async () => {
        const current = TagDoubles.labels();

        const result = current.assignment.assign('dune', [{ id: 'unknown' }]);

        await expect(result).rejects.toMatchObject({ reason: 'tag-missing' });
    });
    it('refuses an empty tag name', async () => {
        const current = TagDoubles.labels();

        const result = current.assignment.assign('dune', [{ name: ' ' }]);

        await expect(result).rejects.toMatchObject({ reason: 'tag-name-invalid' });
    });
    it('lists the tags of a book by name', async () => {
        const current = TagDoubles.labels();
        const fantasy = await TagDoubles.tagged(current, 'Fantasy');
        const adventure = await TagDoubles.tagged(current, 'Adventure');

        await current.assignment.assign('dune', [{ id: fantasy.id }, { id: adventure.id }]);

        const result = await current.assignment.of('dune');

        expect(result.map((tag) => tag.name)).toEqual(['Adventure', 'Fantasy']);
    });
    it('finds tags by id, ordered by name and each once', async () => {
        const current = TagDoubles.labels();
        const fantasy = await TagDoubles.tagged(current, 'Fantasy');
        const adventure = await TagDoubles.tagged(current, 'Adventure');

        const result = await current.assignment.find([fantasy.id, adventure.id, fantasy.id]);

        expect(result).toEqual([
            { id: adventure.id, name: 'Adventure' },
            { id: fantasy.id, name: 'Fantasy' },
        ]);
    });
    it('refuses to find an unknown tag', async () => {
        const current = TagDoubles.labels();

        const result = current.assignment.find(['unknown']);

        await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'tag-missing' });
    });
});
