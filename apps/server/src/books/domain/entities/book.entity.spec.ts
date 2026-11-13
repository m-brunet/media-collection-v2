import { expect, it } from 'vitest';
import { Book } from './book.entity.js';
import type { BookDetails } from './book.entity.js';
import { Isbn } from '../value-objects/isbn.value-object.js';

const details: BookDetails = {
    title: ' Piranesi ',
    titleGenerated: false,
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

const later = '2026-02-01T00:00:00.000Z';

function generated(overrides: Partial<BookDetails> = {}): Book {
    return book({ title: 'Gunnm Vol. 3', titleGenerated: true, category: 'manga', ...overrides });
}

it('accepts a generated title for a Manga', () => {
    const overrides = { category: 'manga' as const };

    const result = generated(overrides).details;

    expect(result).toMatchObject({ title: 'Gunnm Vol. 3', titleGenerated: true });
});

it('accepts a generated title for a Comics', () => {
    const overrides = { category: 'comics' as const };

    const result = generated(overrides).details.titleGenerated;

    expect(result).toBe(true);
});

it('refuses a generated title for a Books record', () => {
    const overrides = { category: 'books' as const };

    const operation = () => generated(overrides);

    expect(operation).toThrow(expect.objectContaining({ reason: 'title-required' }));
});

it('regenerates a generated title from the collection name and coverage', () => {
    const subject = generated();

    const result = subject.regenerateTitle(
        { name: 'Battle Angel Alita', volumeFrom: 3, volumeTo: 4 },
        later,
    );

    expect(result).toBe(true);
    expect(subject.details.title).toBe('Battle Angel Alita Vol. 3–4');
    expect(subject.titleKey).toBe('battle angel alita vol. 3–4');
    expect(subject.snapshot.updatedAt).toBe(later);
});

it('leaves a generated title that already matches its collection unchanged', () => {
    const subject = generated();

    const result = subject.regenerateTitle({ name: 'Gunnm', volumeFrom: 3, volumeTo: 3 }, later);

    expect(result).toBe(false);
    expect(subject.snapshot.updatedAt).toBe(created);
});

it('never replaces a supplied title, even one that looks generated', () => {
    const subject = book({ title: 'Gunnm Vol. 3', category: 'manga' });

    const result = subject.regenerateTitle({ name: 'Alita', volumeFrom: 3, volumeTo: 3 }, later);

    expect(result).toBe(false);
    expect(subject.details).toMatchObject({ title: 'Gunnm Vol. 3', titleGenerated: false });
});

it('keeps a generated title as a supplied one when its collection is deleted', () => {
    const subject = generated();

    const result = subject.keepTitle(later);

    expect(result).toBe(true);
    expect(subject.details).toMatchObject({ title: 'Gunnm Vol. 3', titleGenerated: false });
    expect(subject.snapshot.updatedAt).toBe(later);
});

it('changes nothing when keeping a title that was supplied', () => {
    const subject = book();

    const result = subject.keepTitle(later);

    expect(result).toBe(false);
    expect(subject.snapshot.updatedAt).toBe(created);
});

it('turns a supplied title of a Manga into the generated one', () => {
    const subject = book({ title: 'Gunnm, tome trois', category: 'manga' });

    const result = subject.useGeneratedTitle({ name: 'Gunnm', volumeFrom: 3, volumeTo: 3 }, later);

    expect(result).toBe(true);
    expect(subject.details).toMatchObject({ title: 'Gunnm Vol. 3', titleGenerated: true });
    expect(subject.snapshot.updatedAt).toBe(later);
});

it('generates the title of an omnibus from its coverage', () => {
    const subject = book({ title: 'Gunnm intégrale', category: 'comics' });

    const result = subject.useGeneratedTitle({ name: 'Gunnm', volumeFrom: 1, volumeTo: 3 }, later);

    expect(result).toBe(true);
    expect(subject.details.title).toBe('Gunnm Vol. 1–3');
});

it('leaves a title that is already the generated one unchanged', () => {
    const subject = generated();

    const result = subject.useGeneratedTitle({ name: 'Gunnm', volumeFrom: 3, volumeTo: 3 }, later);

    expect(result).toBe(false);
    expect(subject.snapshot.updatedAt).toBe(created);
});

it('refuses a generated title for a Books record when asked for one', () => {
    const subject = book({ title: 'Gunnm Vol. 3' });

    const operation = () =>
        subject.useGeneratedTitle({ name: 'Gunnm', volumeFrom: 3, volumeTo: 3 }, later);

    expect(operation).toThrow(expect.objectContaining({ reason: 'title-required' }));
});

it('orders numbered titles by the value of their numbers', () => {
    const books = ['Gunnm Vol. 10', 'Gunnm Vol. 2', 'Gunnm Vol. 1–3'].map((title) =>
        generated({ title }),
    );

    const result = books.sort((first, second) =>
        first.titleSortKey.localeCompare(second.titleSortKey),
    );

    expect(result.map((value) => value.details.title)).toEqual([
        'Gunnm Vol. 1–3',
        'Gunnm Vol. 2',
        'Gunnm Vol. 10',
    ]);
});

it('marks a Not Owned book Owned', () => {
    const subject = book({ ownership: 'not-owned' });

    subject.markOwned('2026-02-01T00:00:00.000Z');

    expect(subject.details.ownership).toBe('owned');
    expect(subject.snapshot.updatedAt).toBe('2026-02-01T00:00:00.000Z');
});

it('refuses to mark an Owned book Owned again', () => {
    const subject = book({ ownership: 'owned' });

    const operation = () => subject.markOwned('2026-02-01T00:00:00.000Z');

    expect(operation).toThrow(expect.objectContaining({ reason: 'book-already-owned' }));
});

it('changes the category and keeps a generated title of another series category', () => {
    const subject = generated();

    const result = subject.changeCategory('comics', later);

    expect(result).toBe(true);
    expect(subject.details).toMatchObject({ category: 'comics', titleGenerated: true });
    expect(subject.snapshot.updatedAt).toBe(later);
});

it('keeps a generated title as a supplied one when changing to Books', () => {
    const subject = generated();

    subject.changeCategory('books', later);

    expect(subject.details).toMatchObject({
        category: 'books',
        title: 'Gunnm Vol. 3',
        titleGenerated: false,
    });
});

it('changes nothing when the category stays the same', () => {
    const subject = book();

    const result = subject.changeCategory(subject.details.category, later);

    expect(result).toBe(false);
    expect(subject.snapshot.updatedAt).toBe(created);
});
