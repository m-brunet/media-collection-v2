import { expect, it } from 'vitest';
import { Author } from '../../domain/entities/author.entity.js';
import { BookDoubles } from '../testing/book-doubles.test-support.js';
import { AuthorMatcher } from './author-matcher.service.js';

async function library(...names: string[]) {
    const { authors } = BookDoubles.library();

    for (const [index, name] of names.entries()) {
        await authors.create(
            new Author({ id: 'a' + index, name, createdAt: '2026-03-01T10:00:00.000Z' }),
        );
    }

    return new AuthorMatcher(authors);
}

it('finds an author written the same way but for case and accents', async () => {
    const matcher = await library('Pierre Bottéro');

    const result = await matcher.existing(['pierre bottero']);

    expect(result).toEqual(new Map([['pierre bottero', 'Pierre Bottéro']]));
});

it('finds the one author with a similar name', async () => {
    const matcher = await library("Flipflop's", 'Yuki Kodama');

    const result = await matcher.existing(['Flipsflops']);

    expect(result).toEqual(new Map([['Flipsflops', "Flipflop's"]]));
});

it('keeps a name without any similar author', async () => {
    const matcher = await library('Yuki Kodama');

    const result = await matcher.existing(['Flipsflops']);

    expect(result.size).toBe(0);
});

it('keeps a name similar to several authors', async () => {
    const matcher = await library('Yuki Kodama', 'Rei Kodama');

    const result = await matcher.existing(['Kodama']);

    expect(result.size).toBe(0);
});
