import { expect, it } from 'vitest';
import type { BookBatchDto } from '../../../../../packages/contracts/src/http';
import { BookBatch } from './book-batch.util';

it('sends no field left unchanged', () => {
    const draft = BookBatch.draft();

    const result = BookBatch.changes(draft);

    expect(result).toEqual({});
});

it('sends the value of a field set to a value', () => {
    const draft = {
        ...BookBatch.draft(),
        ownership: 'not-owned' as const,
        publisher: { mode: 'set' as const, value: ' Glénat ' },
        price: { mode: 'set' as const, value: '6,90' },
        shelf: { mode: 'set' as const, bookcaseId: 'oak', shelfId: 'top' },
        read: 'read' as const,
        generatedTitles: true,
    };

    const result = BookBatch.changes(draft);

    expect(result).toEqual({
        ownership: 'not-owned',
        publisher: 'Glénat',
        price: '6,90',
        shelfId: 'top',
        read: true,
        generatedTitles: true,
    });
});

it('sends an explicit null for a cleared field', () => {
    const draft = {
        ...BookBatch.draft(),
        publisher: { mode: 'clear' as const, value: 'Glénat' },
        price: { mode: 'clear' as const, value: '' },
        shelf: { mode: 'clear' as const, bookcaseId: null, shelfId: null },
    };

    const result = BookBatch.changes(draft);

    expect(result).toEqual({ publisher: null, price: null, shelfId: null });
});

it('sends the value of a field filled if empty and names it as filled only', () => {
    const draft = {
        ...BookBatch.draft(),
        publisher: { mode: 'fill' as const, value: ' Glénat ' },
        price: { mode: 'set' as const, value: '6.90' },
        shelf: { mode: 'fill' as const, bookcaseId: 'case', shelfId: 'top' },
    };

    const result = BookBatch.changes(draft);

    expect(result).toEqual({
        publisher: 'Glénat',
        price: '6.90',
        shelfId: 'top',
        onlyIfEmpty: ['publisher', 'shelfId'],
    });
});

it('sends the tags to add and to remove by identifier', () => {
    const draft = {
        ...BookBatch.draft(),
        addTags: [{ id: 'cyberpunk', name: 'Cyberpunk' }],
        removeTags: [{ id: 'old', name: 'Old' }],
    };

    const result = BookBatch.changes(draft);

    expect(result).toEqual({ tags: { add: ['cyberpunk'], remove: ['old'] } });
});

it('sends the typed authors in order, new ones by name', () => {
    const draft = {
        ...BookBatch.draft(),
        replaceAuthors: true,
        authors: [
            { id: null, name: 'Ana', distinct: true },
            { id: 'kishiro', name: 'Yukito Kishiro', distinct: false },
        ],
    };

    const result = BookBatch.changes(draft);

    expect(result).toEqual({ authors: [{ name: 'Ana', distinct: true }, { id: 'kishiro' }] });
});

it('asks for at least one change', () => {
    const draft = BookBatch.draft();

    const result = BookBatch.problem(draft);

    expect(result).toBe('nothing');
});

it('asks for a value when a field is set to an empty one', () => {
    const draft = { ...BookBatch.draft(), publisher: { mode: 'set' as const, value: ' ' } };

    const result = BookBatch.problem(draft);

    expect(result).toBe('publisher');
});

it('asks for a value when a field is filled with an empty one', () => {
    const draft = { ...BookBatch.draft(), price: { mode: 'fill' as const, value: ' ' } };

    const result = BookBatch.problem(draft);

    expect(result).toBe('price');
});

it('asks for a shelf when filling the shelf without choosing one', () => {
    const draft = {
        ...BookBatch.draft(),
        shelf: { mode: 'fill' as const, bookcaseId: null, shelfId: null },
    };

    const result = BookBatch.problem(draft);

    expect(result).toBe('shelf');
});

it('asks for authors when replacing them with none', () => {
    const draft = { ...BookBatch.draft(), replaceAuthors: true };

    const result = BookBatch.problem(draft);

    expect(result).toBe('authors');
});

it('uses the chosen existing author for a similar typed name', () => {
    const draft = {
        ...BookBatch.draft(),
        replaceAuthors: true,
        authors: [{ id: null, name: 'Yukito Kishir', distinct: false }],
    };

    const result = BookBatch.resolveAuthor(draft, 'yukito kishir', {
        id: 'kishiro',
        name: 'Yukito Kishiro',
    });

    expect(result.authors).toEqual([{ id: 'kishiro', name: 'Yukito Kishiro', distinct: false }]);
});

it('describes each changed field from its old to its new value', () => {
    const before = { title: 'Gunnm, the first', publisher: null, priceCents: 690 };
    const after = { title: 'Gunnm Vol. 1', publisher: 'Glénat', priceCents: null };

    const result = BookBatch.lines(before, after, 'en-GB');

    expect(result).toEqual([
        {
            label: 'form.title',
            before: { text: 'Gunnm, the first' },
            after: { text: 'Gunnm Vol. 1' },
        },
        { label: 'form.publisher', before: { key: 'batch.none' }, after: { text: 'Glénat' } },
        { label: 'batch.price', before: { text: '€6.90' }, after: { key: 'batch.none' } },
    ]);
});

it('says that a generated title is kept as a hand-written one', () => {
    const before = { titleGenerated: true };
    const after = { titleGenerated: false };

    const result = BookBatch.lines(before, after, 'en-GB');

    expect(result).toEqual([
        { label: 'form.title', before: { key: 'batch.generated' }, after: { key: 'batch.kept' } },
    ]);
});

it('describes a shelf by its bookcase', () => {
    const before = { location: null };
    const after = {
        location: { bookcaseId: 'oak', bookcaseName: 'Oak', shelfId: 'top', shelfName: 'Top' },
    };

    const result = BookBatch.lines(before, after, 'en-GB');

    expect(result).toEqual([
        {
            label: 'batch.location',
            before: { key: 'batch.noLocation' },
            after: { text: 'Oak · Top' },
        },
    ]);
});

it('names the reason a book was left out', () => {
    const reason = 'book-lent' as const;

    const result = BookBatch.skipReason(reason);

    expect(result).toBe('batch.skip.lent');
});

it('adds a change card with a value to set by default', () => {
    const draft = BookBatch.draft();

    const result = BookBatch.add(draft, 'publisher');

    expect(result.fields).toEqual(['publisher']);
    expect(result.publisher).toEqual({ mode: 'set', value: '' });
});

it('replaces the authors and uses the generated titles once their cards are added', () => {
    const draft = BookBatch.add(BookBatch.draft(), 'authors');

    const result = BookBatch.add(draft, 'titles');

    expect(result.fields).toEqual(['authors', 'titles']);
    expect(result.replaceAuthors).toBe(true);
    expect(result.generatedTitles).toBe(true);
});

it('adds a change card only once', () => {
    const draft = BookBatch.add(BookBatch.draft(), 'tags');

    const result = BookBatch.add(draft, 'tags');

    expect(result.fields).toEqual(['tags']);
});

it('forgets the value of a removed change card', () => {
    const draft = {
        ...BookBatch.add(BookBatch.draft(), 'price'),
        price: { mode: 'fill' as const, value: '6.90' },
    };

    const result = BookBatch.remove(draft, 'price');

    expect(result.fields).toEqual([]);
    expect(BookBatch.changes(result)).toEqual({});
});

it('forgets the tags of a removed tags card', () => {
    const draft = {
        ...BookBatch.add(BookBatch.draft(), 'tags'),
        addTags: [{ id: 'shonen', name: 'Shonen' }],
    };

    const result = BookBatch.remove(draft, 'tags');

    expect(result.addTags).toEqual([]);
    expect(BookBatch.changes(result)).toEqual({});
});

it('offers the change cards not added yet, in form order', () => {
    const draft = BookBatch.add(BookBatch.add(BookBatch.draft(), 'tags'), 'ownership');

    const result = BookBatch.remaining(draft);

    expect(result).toEqual(['publisher', 'price', 'shelf', 'authors', 'read', 'titles']);
});

it('asks for a reading status when its card has no choice yet', () => {
    const draft = BookBatch.add(BookBatch.draft(), 'read');

    const result = BookBatch.problem(draft);

    expect(result).toBe('read');
});

function plan(): BookBatchDto {
    return {
        collection: { id: 'c1', name: 'Gunnm' },
        saved: false,
        books: [
            {
                id: 'one',
                title: 'Gunnm 1',
                before: { publisher: null, priceCents: 690 },
                after: { publisher: 'Glénat', priceCents: null },
            },
            {
                id: 'two',
                title: 'Gunnm 2',
                before: { publisher: 'Kana' },
                after: { publisher: 'Glénat' },
            },
            { id: 'three', title: 'Gunnm 3', before: {}, after: {} },
        ],
        skipped: [{ id: 'four', title: 'Gunnm 4', reason: 'book-lent' }],
    };
}

it('groups the planned changes by field, with the books each one reaches', () => {
    const summary = plan();

    const result = BookBatch.byChange(summary, 'en-GB');

    expect(result).toEqual([
        {
            label: 'form.publisher',
            after: { text: 'Glénat' },
            books: [
                {
                    id: 'one',
                    title: 'Gunnm 1',
                    before: { key: 'batch.none' },
                    after: { text: 'Glénat' },
                },
                {
                    id: 'two',
                    title: 'Gunnm 2',
                    before: { text: 'Kana' },
                    after: { text: 'Glénat' },
                },
            ],
            others: 1,
        },
        {
            label: 'batch.price',
            after: { key: 'batch.none' },
            books: [
                {
                    id: 'one',
                    title: 'Gunnm 1',
                    before: { text: '€6.90' },
                    after: { key: 'batch.none' },
                },
            ],
            others: 2,
        },
    ]);
});

it('gives no common new value to a change that differs per book', () => {
    const summary = {
        ...plan(),
        books: [
            { id: 'one', title: 'a', before: { title: 'a' }, after: { title: 'Gunnm Vol. 1' } },
            { id: 'two', title: 'b', before: { title: 'b' }, after: { title: 'Gunnm Vol. 2' } },
        ],
    };

    const result = BookBatch.byChange(summary, 'en-GB');

    expect(result.map((group) => group.after)).toEqual([null]);
});

it('counts the changes of each book and marks the books left out', () => {
    const summary = plan();

    const result = BookBatch.outcomes(summary, 'en-GB');

    expect([...result]).toEqual([
        ['one', { changes: 2 }],
        ['two', { changes: 1 }],
        ['three', { changes: 0 }],
        ['four', 'left-out'],
    ]);
});

it('counts the books that change', () => {
    const summary = plan();

    const result = BookBatch.changed(summary);

    expect(result).toBe(2);
});

it('keeps only the plan of one book', () => {
    const summary = plan();

    const result = BookBatch.only(summary, 'four');

    expect(result.books).toEqual([]);
    expect(result.skipped).toEqual([{ id: 'four', title: 'Gunnm 4', reason: 'book-lent' }]);
});

it('says when a planned change only fills the books without a value', () => {
    const draft = { ...BookBatch.draft(), price: { mode: 'fill' as const, value: '6.90' } };

    const result = BookBatch.fillsOnly(draft, 'batch.price');

    expect(result).toBe(true);
});

it('says when a planned change sets every book', () => {
    const draft = {
        ...BookBatch.draft(),
        publisher: { mode: 'set' as const, value: 'Kana' },
    };

    const result = BookBatch.fillsOnly(draft, 'form.publisher');

    expect(result).toBe(false);
});
