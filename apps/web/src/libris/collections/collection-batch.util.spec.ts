import { expect, it } from 'vitest';
import type {
    CollectionDetailsDto,
    CollectionMemberDto,
} from '../../../../../packages/contracts/src/http';
import { CollectionBatch } from './collection-batch.util';

function member(id: string, overrides: Partial<CollectionMemberDto> = {}): CollectionMemberDto {
    return {
        id,
        title: id,
        isbn: null,
        publisher: null,
        category: 'manga',
        ownership: 'owned',
        hasCover: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        volumeFrom: 1,
        volumeTo: 1,
        ...overrides,
    };
}

function collection(volumes: CollectionDetailsDto['volumes']): CollectionDetailsDto {
    return {
        id: 'c1',
        name: 'Gunnm',
        includesVolumeZero: false,
        finished: false,
        bookCount: 3,
        expectedFrom: 1,
        expectedTo: 3,
        expectedCount: 3,
        ownedCount: 2,
        missingCount: 1,
        lastOwned: 2,
        previews: [],
        volumes,
    };
}

const omnibus = member('omnibus', { volumeFrom: 1, volumeTo: 2 });
const gunnm = collection([
    { from: 1, to: 1, state: 'owned', books: [member('one'), omnibus] },
    { from: 2, to: 2, state: 'owned', books: [omnibus] },
    {
        from: 3,
        to: 3,
        state: 'planned',
        books: [member('three', { ownership: 'not-owned', volumeFrom: 3, volumeTo: 3 })],
    },
]);

it('lists each book of the collection once, in volume order', () => {
    const subject = gunnm;

    const result = CollectionBatch.books(subject).map((book) => book.id);

    expect(result).toEqual(['omnibus', 'one', 'three']);
});

it('selects the owned books only', () => {
    const subject = gunnm;

    const result = CollectionBatch.owned(subject);

    expect(result).toEqual(['omnibus', 'one']);
});

it('sends no field left unchanged', () => {
    const draft = CollectionBatch.draft();

    const result = CollectionBatch.changes(draft);

    expect(result).toEqual({});
});

it('sends the value of a field set to a value', () => {
    const draft = {
        ...CollectionBatch.draft(),
        category: 'comics' as const,
        publisher: { mode: 'set' as const, value: ' Glénat ' },
        price: { mode: 'set' as const, value: '6,90' },
        shelf: { mode: 'set' as const, bookcaseId: 'oak', shelfId: 'top' },
        read: 'read' as const,
        generatedTitles: true,
    };

    const result = CollectionBatch.changes(draft);

    expect(result).toEqual({
        category: 'comics',
        publisher: 'Glénat',
        price: '6,90',
        shelfId: 'top',
        read: true,
        generatedTitles: true,
    });
});

it('sends an explicit null for a cleared field', () => {
    const draft = {
        ...CollectionBatch.draft(),
        publisher: { mode: 'clear' as const, value: 'Glénat' },
        price: { mode: 'clear' as const, value: '' },
        shelf: { mode: 'clear' as const, bookcaseId: null, shelfId: null },
    };

    const result = CollectionBatch.changes(draft);

    expect(result).toEqual({ publisher: null, price: null, shelfId: null });
});

it('sends the value of a field filled if empty and names it as filled only', () => {
    const draft = {
        ...CollectionBatch.draft(),
        publisher: { mode: 'fill' as const, value: ' Glénat ' },
        price: { mode: 'set' as const, value: '6.90' },
        shelf: { mode: 'fill' as const, bookcaseId: 'case', shelfId: 'top' },
    };

    const result = CollectionBatch.changes(draft);

    expect(result).toEqual({
        publisher: 'Glénat',
        price: '6.90',
        shelfId: 'top',
        onlyIfEmpty: ['publisher', 'shelfId'],
    });
});

it('sends the tags to add and to remove by identifier', () => {
    const draft = {
        ...CollectionBatch.draft(),
        addTags: [{ id: 'cyberpunk', name: 'Cyberpunk' }],
        removeTags: [{ id: 'old', name: 'Old' }],
    };

    const result = CollectionBatch.changes(draft);

    expect(result).toEqual({ tags: { add: ['cyberpunk'], remove: ['old'] } });
});

it('sends the typed authors in order, new ones by name', () => {
    const draft = {
        ...CollectionBatch.draft(),
        replaceAuthors: true,
        authors: [
            { id: null, name: 'Ana', distinct: true },
            { id: 'kishiro', name: 'Yukito Kishiro', distinct: false },
        ],
    };

    const result = CollectionBatch.changes(draft);

    expect(result).toEqual({ authors: [{ name: 'Ana', distinct: true }, { id: 'kishiro' }] });
});

it('asks for at least one change', () => {
    const draft = CollectionBatch.draft();

    const result = CollectionBatch.problem(draft);

    expect(result).toBe('nothing');
});

it('asks for a value when a field is set to an empty one', () => {
    const draft = { ...CollectionBatch.draft(), publisher: { mode: 'set' as const, value: ' ' } };

    const result = CollectionBatch.problem(draft);

    expect(result).toBe('publisher');
});

it('asks for a value when a field is filled with an empty one', () => {
    const draft = { ...CollectionBatch.draft(), price: { mode: 'fill' as const, value: ' ' } };

    const result = CollectionBatch.problem(draft);

    expect(result).toBe('price');
});

it('asks for a shelf when filling the shelf without choosing one', () => {
    const draft = {
        ...CollectionBatch.draft(),
        shelf: { mode: 'fill' as const, bookcaseId: null, shelfId: null },
    };

    const result = CollectionBatch.problem(draft);

    expect(result).toBe('shelf');
});

it('asks for authors when replacing them with none', () => {
    const draft = { ...CollectionBatch.draft(), replaceAuthors: true };

    const result = CollectionBatch.problem(draft);

    expect(result).toBe('authors');
});

it('uses the chosen existing author for a similar typed name', () => {
    const draft = {
        ...CollectionBatch.draft(),
        replaceAuthors: true,
        authors: [{ id: null, name: 'Yukito Kishir', distinct: false }],
    };

    const result = CollectionBatch.resolveAuthor(draft, 'yukito kishir', {
        id: 'kishiro',
        name: 'Yukito Kishiro',
    });

    expect(result.authors).toEqual([{ id: 'kishiro', name: 'Yukito Kishiro', distinct: false }]);
});

it('describes each changed field from its old to its new value', () => {
    const before = { title: 'Gunnm, the first', publisher: null, priceCents: 690 };
    const after = { title: 'Gunnm Vol. 1', publisher: 'Glénat', priceCents: null };

    const result = CollectionBatch.lines(before, after, 'en-GB');

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
    const before = { titleGenerated: true, category: 'manga' as const };
    const after = { titleGenerated: false, category: 'books' as const };

    const result = CollectionBatch.lines(before, after, 'en-GB');

    expect(result).toEqual([
        { label: 'form.title', before: { key: 'batch.generated' }, after: { key: 'batch.kept' } },
        {
            label: 'form.category',
            before: { key: 'category.manga' },
            after: { key: 'category.books' },
        },
    ]);
});

it('describes a shelf by its bookcase', () => {
    const before = { location: null };
    const after = {
        location: { bookcaseId: 'oak', bookcaseName: 'Oak', shelfId: 'top', shelfName: 'Top' },
    };

    const result = CollectionBatch.lines(before, after, 'en-GB');

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

    const result = CollectionBatch.skipReason(reason);

    expect(result).toBe('batch.skip.lent');
});
