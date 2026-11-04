import { expect, it } from 'vitest';
import { Book } from './book.entity.js';
import type { BookDetails } from './book.entity.js';
import { Isbn } from '../value-objects/isbn.value-object.js';

const details: BookDetails = {
    title: ' Piranesi ',
    isbn: Isbn.parse('9781635575637'),
    noIsbn: false,
    authorIds: ['clarke'],
    category: 'books',
    ownership: 'owned',
    publisher: ' Bloomsbury ',
    publicationDate: null,
    summary: '  ',
    pageCount: 272,
    price: null,
};
const created = '2026-01-01T00:00:00.000Z';

function book(overrides: Partial<BookDetails> = {}): Book {
    return new Book({
        id: 'piranesi',
        details: { ...details, ...overrides },
        coverFile: null,
        createdAt: created,
        updatedAt: created,
    });
}

it('trims texts and keeps empty optional texts as unknown', () => {
    const input = { ...details };

    const result = book(input).details;

    expect(result).toMatchObject({ title: 'Piranesi', publisher: 'Bloomsbury', summary: null });
});

it('compares titles ignoring case and accents', () => {
    const subject = book({ title: 'Élan Vital' });

    const result = subject.titleKey;

    expect(result).toBe('elan vital');
});

it('accepts a book explicitly without ISBN', () => {
    const input = { isbn: null, noIsbn: true };

    const operation = () => book(input);

    expect(operation).not.toThrow();
});

it('requires an ISBN unless the book is stated to have none', () => {
    const input = { isbn: null, noIsbn: false };

    const operation = () => book(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'isbn-required' }));
});

it('rejects an ISBN on a book stated to have none', () => {
    const input = { noIsbn: true };

    const operation = () => book(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'isbn-required' }));
});

it('requires a title', () => {
    const input = { title: '  ' };

    const operation = () => book(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'title-invalid' }));
});

it('requires at least one author', () => {
    const input = { authorIds: [] };

    const operation = () => book(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'authors-required' }));
});

it('rejects the same author twice', () => {
    const input = { authorIds: ['clarke', 'clarke'] };

    const operation = () => book(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'authors-required' }));
});

it('rejects a page count of zero', () => {
    const input = { pageCount: 0 };

    const operation = () => book(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'page-count-invalid' }));
});

it('edits the shared details and records when', () => {
    const subject = book();

    subject.edit({ ...details, title: 'Piranesi (paperback)' }, '2026-02-01T00:00:00.000Z');

    expect(subject.snapshot).toMatchObject({
        details: { title: 'Piranesi (paperback)' },
        updatedAt: '2026-02-01T00:00:00.000Z',
    });
});

it('replaces and removes the cover', () => {
    const subject = book();

    subject.replaceCover(null, '2026-02-01T00:00:00.000Z');

    expect(subject.snapshot.coverFile).toBeNull();
});
