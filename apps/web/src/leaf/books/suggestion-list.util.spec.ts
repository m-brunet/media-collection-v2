import { describe, expect, it } from 'vitest';
import { SuggestionList } from './suggestion-list.util';

const authors = [
    { id: 'a1', name: 'Yukito Kishiro' },
    { id: 'a2', name: 'Yuki Kodama' },
];

describe('SuggestionList', () => {
    it('suggests the names found, with their identifier', () => {
        const suggestions = SuggestionList.of(authors, 'yuk');

        expect(suggestions).toEqual([
            { key: 'a1', label: 'Yukito Kishiro' },
            { key: 'a2', label: 'Yuki Kodama' },
        ]);
    });
    it('suggests nothing before a letter is typed', () => {
        const suggestions = SuggestionList.of(authors, '  ');

        expect(suggestions).toEqual([]);
    });
    it('suggests at most 5 names', () => {
        const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: 'Yuki ' + id }));

        const suggestions = SuggestionList.of(many, 'yuki');

        expect(suggestions.map((suggestion) => suggestion.key)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
    it('leaves out a name that no longer matches what is typed', () => {
        const suggestions = SuggestionList.of(authors, 'yukit');

        expect(suggestions).toEqual([{ key: 'a1', label: 'Yukito Kishiro' }]);
    });
    it('matches what is typed anywhere in the name, whatever its case and accents', () => {
        const suggestions = SuggestionList.of([{ id: 'a3', name: 'Hergé' }], 'ERGE');

        expect(suggestions).toEqual([{ key: 'a3', label: 'Hergé' }]);
    });
    it('leaves out a name already chosen, whatever its case and accents', () => {
        const suggestions = SuggestionList.of(authors, 'yuk', ['YÛKI KODAMA']);

        expect(suggestions).toEqual([{ key: 'a1', label: 'Yukito Kishiro' }]);
    });
    it('leaves out the name exactly as typed', () => {
        const collections = [
            { id: 'c1', name: 'Gunnm' },
            { id: 'c2', name: 'Gunnm Last Order' },
        ];

        const suggestions = SuggestionList.of(collections, 'Gunnm');

        expect(suggestions).toEqual([{ key: 'c2', label: 'Gunnm Last Order' }]);
    });
});
