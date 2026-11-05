import { describe, expect, it } from 'vitest';
import { guest, labelled, labels, tagged } from '../testing/tag-doubles.test-support.js';
import { ListTags } from './list-tags.usecase.js';

describe('ListTags', () => {
    it('lists tags by name with their book counts, unused ones included', async () => {
        const current = labels();
        const fantasy = await tagged(current, 'Fantasy');

        await tagged(current, 'Adventure');
        await labelled(current, 'dune', fantasy);

        const result = await new ListTags(current.tags, current.store, current.viewer).execute(
            guest,
            '',
        );

        expect(result).toEqual([
            { id: 'tag-2', name: 'Adventure', bookCount: 0 },
            { id: fantasy.id, name: 'Fantasy', bookCount: 1 },
        ]);
    });
    it('keeps the tags whose name contains the search, ignoring case and accents', async () => {
        const current = labels();

        await tagged(current, 'Médiéval');
        await tagged(current, 'Fantasy');

        const result = await new ListTags(current.tags, current.store, current.viewer).execute(
            guest,
            'EVAL',
        );

        expect(result.map((tag) => tag.name)).toEqual(['Médiéval']);
    });
});
