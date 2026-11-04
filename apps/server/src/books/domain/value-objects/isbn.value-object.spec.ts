import { expect, it } from 'vitest';
import { Isbn } from './isbn.value-object.js';

it('accepts a valid ISBN-13', () => {
    const input = '9781635575637';

    const result = Isbn.parse(input);

    expect(result).toMatchObject({ isbn13: '9781635575637', convertedFromIsbn10: false });
});

it('ignores spaces and hyphens', () => {
    const input = '978-1-63557-563-7';

    const result = Isbn.parse(input);

    expect(result.isbn13).toBe('9781635575637');
});

it('converts a valid ISBN-10 to its ISBN-13 equivalent', () => {
    const input = '0-306-40615-2';

    const result = Isbn.parse(input);

    expect(result).toMatchObject({ isbn13: '9780306406157', convertedFromIsbn10: true });
});

it('accepts an ISBN-10 ending with X', () => {
    const input = '080442957X';

    const result = Isbn.parse(input);

    expect(result.isbn13).toBe('9780804429573');
});

it('rejects a wrong check digit', () => {
    const input = '9781635575638';

    const operation = () => Isbn.parse(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'isbn-invalid' }));
});

it('rejects text that is not an ISBN', () => {
    const input = 'not an isbn';

    const operation = () => Isbn.parse(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'isbn-invalid' }));
});

it('finds the ISBN-13 an ISBN-10 search stands for', () => {
    const input = '0306406152';

    const result = Isbn.equivalent(input);

    expect(result).toBe('9780306406157');
});

it('has no equivalent for a partial number', () => {
    const input = '978030';

    const result = Isbn.equivalent(input);

    expect(result).toBeNull();
});
