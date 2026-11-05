import { describe, expect, it } from 'vitest';
import { library } from '../testing/book-doubles.test-support.js';

describe('BookOrganiser', () => {
    it('applies a shelf and tags, with the tag changes to record', async () => {
        const current = library();

        const result = await current.organiser.apply('dune', {
            shelfId: 'shelf-3',
            tags: [{ name: 'Fantasy' }],
        });

        expect(result.organisation).toEqual({
            location: {
                bookcaseId: 'oak',
                bookcaseName: 'Oak',
                shelfId: 'shelf-3',
                shelfName: 'Shelf 3',
            },
            tags: [{ id: 'tag-Fantasy', name: 'Fantasy' }],
        });
        expect(result.changes).toEqual([expect.objectContaining({ category: 'tag.created' })]);
    });
    it('keeps the tags when only the shelf changes', async () => {
        const current = library();

        await current.organiser.apply('dune', { shelfId: 'shelf-3', tags: [{ name: 'Fantasy' }] });

        const result = await current.organiser.apply('dune', { shelfId: 'top' });

        expect(result.organisation.tags).toEqual([{ id: 'tag-Fantasy', name: 'Fantasy' }]);
        expect(result.organisation.location?.shelfName).toBe('Top');
    });
    it('keeps the shelf when only the tags change', async () => {
        const current = library();

        await current.organiser.apply('dune', { shelfId: 'shelf-3', tags: [] });

        const result = await current.organiser.apply('dune', { tags: [{ id: 'history' }] });

        expect(result.organisation.location?.shelfId).toBe('shelf-3');
        expect(result.changes).toEqual([]);
    });
    it('describes the current location and tags', async () => {
        const current = library();

        await current.organiser.apply('dune', { shelfId: null, tags: [{ name: 'Fantasy' }] });

        const result = await current.organiser.current('dune');

        expect(result).toEqual({ location: null, tags: [{ id: 'tag-Fantasy', name: 'Fantasy' }] });
    });
    it('refuses an unknown tag', async () => {
        const current = library();

        const result = current.organiser.apply('dune', { tags: [{ id: 'removed' }] });

        await expect(result).rejects.toMatchObject({ reason: 'tag-missing' });
    });
    it('reuses an existing tag for an equivalent name, once', async () => {
        const current = library();

        const result = await current.organiser.apply('dune', {
            tags: [{ name: ' history ' }, { id: 'history' }],
        });

        expect(result.organisation.tags).toEqual([{ id: 'history', name: 'History' }]);
    });
    it('refuses a blank new tag name', async () => {
        const current = library();

        const result = current.organiser.apply('dune', { tags: [{ name: '   ' }] });

        await expect(result).rejects.toMatchObject({ reason: 'tag-name-invalid' });
    });
    it('reports nothing for a tag that already exists', async () => {
        const current = library();

        const result = await current.organiser.apply('dune', { tags: [{ name: 'history' }] });

        expect(result.changes).toEqual([]);
    });
});
