import { describe, expect, it } from 'vitest';
import type { BookLookupFieldsDto } from '../../../../../packages/contracts/src/http';
import type { BookDraftValues } from './book-draft.util';
import { BookDraft } from './book-draft.util';
import type { LookupSelection } from './lookup-fill.util';
import { LookupFill } from './lookup-fill.util';

function fields(overrides: Partial<BookLookupFieldsDto> = {}): BookLookupFieldsDto {
    return {
        title: [],
        authors: [],
        publisher: [],
        publicationDate: [],
        pageCount: [],
        summary: [],
        collection: [],
        ...overrides,
    };
}

function selection(overrides: Partial<LookupSelection> = {}): LookupSelection {
    return {
        title: null,
        authors: null,
        publisher: null,
        publication: null,
        pageCount: null,
        summary: null,
        collection: null,
        ...overrides,
    };
}

function draft(overrides: Partial<BookDraftValues> = {}): BookDraftValues {
    return { ...BookDraft.empty(), isbn: '9782845998179', ...overrides };
}

describe('LookupFill', () => {
    it("selects the preferred source's value of every field", () => {
        const found = fields({
            title: [
                { value: 'Rose hip Rose. 1', sources: ['bnf'] },
                { value: 'Rose Hip Rose', sources: ['openlibrary'] },
            ],
            pageCount: [{ value: 176, sources: ['bnf'] }],
        });

        const selected = LookupFill.defaults(found, draft());

        expect(selected).toMatchObject({
            title: 'Rose hip Rose. 1',
            pageCount: 176,
            publisher: null,
        });
    });

    it('keeps the generated title of a manga in a collection with a blank title', () => {
        const found = fields({
            title: [{ value: 'Rose hip Rose. 1', sources: ['bnf'] }],
            collection: [{ value: { name: 'Rose hip Rose', volume: 1 }, sources: ['bnf'] }],
        });

        const selected = LookupFill.defaults(found, draft({ category: 'manga' }));

        expect(selected.title).toBeNull();
    });

    it('offers the title of a manga whose title was typed', () => {
        const found = fields({
            title: [{ value: 'Rose hip Rose. 1', sources: ['bnf'] }],
            collection: [{ value: { name: 'Rose hip Rose', volume: 1 }, sources: ['bnf'] }],
        });

        const selected = LookupFill.defaults(found, draft({ category: 'manga', title: 'Mine' }));

        expect(selected.title).toBe('Rose hip Rose. 1');
    });

    it('fills the empty fields (example 12)', () => {
        const chosen = selection({
            title: "D'un monde à l'autre",
            authors: ['Pierre Bottero'],
            publication: { year: 2012, month: 3 },
            pageCount: 257,
            collection: { name: "La quête d'Ewilan", volume: 1 },
        });

        const { next, conflicts } = LookupFill.apply(draft(), chosen);

        expect(conflicts).toEqual([]);
        expect(next).toMatchObject({
            title: "D'un monde à l'autre",
            authors: [{ id: null, name: 'Pierre Bottero', distinct: false }],
            publicationYear: '2012',
            publicationMonth: '3',
            pageCount: '257',
            inCollection: true,
            collectionName: "La quête d'Ewilan",
            volumeFrom: '1',
            volumeTo: '1',
        });
    });

    it('asks before replacing a value the person typed (example 12)', () => {
        const chosen = selection({ title: 'Piranesi — A Novel', publisher: 'Bloomsbury' });

        const { next, conflicts } = LookupFill.apply(draft({ title: 'Piranesi' }), chosen);

        expect(next).toMatchObject({ title: 'Piranesi', publisher: 'Bloomsbury' });
        expect(conflicts).toEqual([
            { field: 'title', mine: 'Piranesi', lookup: 'Piranesi — A Novel' },
        ]);
    });

    it('does not ask about values differing only by case or accents', () => {
        const chosen = selection({ publisher: 'Glénat', authors: ['Yagi Norihiro'] });
        const typed = draft({
            publisher: 'glenat',
            authors: [{ id: 'a1', name: 'yagi norihiro', distinct: false }],
        });

        const { conflicts } = LookupFill.apply(typed, chosen);

        expect(conflicts).toEqual([]);
    });

    it('asks before moving the book to another collection or volume', () => {
        const chosen = selection({ collection: { name: 'Claymore', volume: 15 } });
        const typed = draft({ inCollection: true, collectionName: 'Claymore', volumeFrom: '14' });

        const { conflicts } = LookupFill.apply(typed, chosen);

        expect(conflicts).toEqual([
            { field: 'collection', mine: 'Claymore · 14', lookup: 'Claymore · 15' },
        ]);
    });

    it('leaves a field alone when nothing was selected for it', () => {
        const { next } = LookupFill.apply(draft({ title: 'Mine' }), selection());

        expect(next.title).toBe('Mine');
    });

    it('replaces the conflicting fields the person chose', () => {
        const chosen = selection({ title: 'Piranesi — A Novel', pageCount: 272 });
        const typed = draft({ title: 'Piranesi', pageCount: '250' });

        const next = LookupFill.replace(typed, chosen, ['pageCount']);

        expect(next).toMatchObject({ title: 'Piranesi', pageCount: '272' });
    });
});
