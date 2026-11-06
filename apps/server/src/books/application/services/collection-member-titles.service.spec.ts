import { expect, it } from 'vitest';
import { library, saved } from '../testing/book-doubles.test-support.js';
import { CollectionMemberTitles } from './collection-member-titles.service.js';

const gunnm = { collection: { name: 'Gunnm' }, volumeFrom: 3, volumeTo: 3 };

function subject(current: ReturnType<typeof library>) {
    return new CollectionMemberTitles(current.books, current.clock);
}

async function generatedBook(current: ReturnType<typeof library>) {
    return saved(current, {
        title: '',
        isbn: null,
        noIsbn: true,
        category: 'manga',
        collection: gunnm,
    });
}

it('gives generated titles the new collection name, recording each change', async () => {
    const current = library();
    const book = await generatedBook(current);

    const result = await subject(current).regenerate('Battle Angel Alita', [
        { bookId: book.id, volumeFrom: 3, volumeTo: 3 },
    ]);

    expect(current.books.books.get(book.id)!.details.title).toBe('Battle Angel Alita - 3');
    expect(result).toEqual([
        {
            category: 'book.retitled',
            subjectType: 'book',
            subjectId: book.id,
            before: { title: 'Gunnm - 3', titleGenerated: true },
            after: { title: 'Battle Angel Alita - 3', titleGenerated: true },
        },
    ]);
});

it('leaves supplied titles unchanged on a rename', async () => {
    const current = library();
    const book = await saved(current, { category: 'manga', collection: gunnm });

    const result = await subject(current).regenerate('Battle Angel Alita', [
        { bookId: book.id, volumeFrom: 3, volumeTo: 3 },
    ]);

    expect(result).toEqual([]);
    expect(current.books.books.get(book.id)!.details.title).toBe('Piranesi');
});

it('keeps generated titles as supplied titles, recording each change', async () => {
    const current = library();
    const book = await generatedBook(current);

    const result = await subject(current).keep([book.id]);

    expect(current.books.books.get(book.id)!.details).toMatchObject({
        title: 'Gunnm - 3',
        titleGenerated: false,
    });
    expect(result).toEqual([
        expect.objectContaining({
            category: 'book.retitled',
            subjectId: book.id,
            before: { title: 'Gunnm - 3', titleGenerated: true },
            after: { title: 'Gunnm - 3', titleGenerated: false },
        }),
    ]);
});

it('records nothing for a supplied title kept on deletion', async () => {
    const current = library();
    const book = await saved(current, { category: 'manga', collection: gunnm });

    const result = await subject(current).keep([book.id]);

    expect(result).toEqual([]);
});
