import { expect, it } from 'vitest';
import type { AuthorSpellingDto } from '../../../../../packages/contracts/src/http';
import type { DraftAuthor } from './book-draft.util';
import { AuthorSpellings } from './author-spellings.util';

const spelling: AuthorSpellingDto = {
    name: "Flipflop's",
    spelling: 'Flipsflops',
    sources: ['bnf'],
};

const filledIn: DraftAuthor[] = [
    { id: null, name: "Flipflop's", distinct: false },
    { id: null, name: 'Yuki Kodama', distinct: false },
];

it('offers the source’s spelling of an existing author in the form', () => {
    const result = AuthorSpellings.offered(filledIn, [spelling]);

    expect(result).toEqual([spelling]);
});

it('no longer offers a spelling once its author is removed', () => {
    const result = AuthorSpellings.offered([filledIn[1]!], [spelling]);

    expect(result).toEqual([]);
});

it('replaces the existing author with a new one spelt as the source does', () => {
    const result = AuthorSpellings.used(filledIn, spelling);

    expect(result).toEqual([
        { id: null, name: 'Flipsflops', distinct: true },
        { id: null, name: 'Yuki Kodama', distinct: false },
    ]);
});
