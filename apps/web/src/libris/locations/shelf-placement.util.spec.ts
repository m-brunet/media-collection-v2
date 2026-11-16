import { describe, expect, it } from 'vitest';
import type { BookLocationDto } from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { en } from '../../shared/i18n/catalog-en';
import { fr } from '../../shared/i18n/catalog-fr';
import type { MessageValues } from '../../shared/i18n/translator.util';
import { Translator } from '../../shared/i18n/translator.util';
import { ShelfPlacement } from './shelf-placement.util';

const english = new Translator('en', en);
const french = new Translator('fr', fr);
const t = (key: MessageKey, values?: MessageValues) => english.translate(key, values);
const tFr = (key: MessageKey, values?: MessageValues) => french.translate(key, values);
const shelf: BookLocationDto = {
    bookcaseId: 'oak',
    bookcaseName: 'Study · oak',
    shelfId: 's3',
    shelfName: 'Shelf 3',
};
const hallway: BookLocationDto = {
    bookcaseId: 'hall',
    bookcaseName: 'Hallway',
    shelfId: 'h1',
    shelfName: 'Shelf 1',
};
const lounge: BookLocationDto = {
    bookcaseId: 'lounge',
    bookcaseName: 'Lounge · left',
    shelfId: 'l2',
    shelfName: 'Shelf 2',
};

describe('ShelfPlacement', () => {
    it('opens the screen of a shelf on the books without a location', () => {
        const path = ShelfPlacement.opening('s3');

        expect(path).toBe('/bookshelves/shelves/s3/add-books?location=none');
    });
    it('counts the books placed and the books moved, naming each shelf they leave once', () => {
        const books = [{ from: null }, { from: hallway }, { from: hallway }, { from: lounge }];

        const summary = ShelfPlacement.summary(books, 'Shelf 3', t, 'en-GB');

        expect(summary).toBe(
            '1 placed on Shelf 3 · 3 moved from Hallway – Shelf 1 and Lounge · left – Shelf 2',
        );
    });
    it('says no book moves when none had a shelf', () => {
        const summary = ShelfPlacement.summary([{ from: null }], 'Shelf 3', t, 'en-GB');

        expect(summary).toBe('1 placed on Shelf 3 · none moved from another shelf');
    });
    it('leaves the placed part out when every book moves', () => {
        const summary = ShelfPlacement.summary([{ from: hallway }], 'Shelf 3', tFr, 'fr-FR');

        expect(summary).toBe('1 déplacé depuis Hallway – Shelf 1');
    });
    it('reports a saved placement with the books that were already there', () => {
        const message = ShelfPlacement.done(
            {
                shelf,
                placed: [{ id: 'a', title: 'A' }],
                moved: [{ id: 'b', title: 'B', from: hallway }],
                unchanged: [{ id: 'c', title: 'C' }],
            },
            t,
            'en-GB',
        );

        expect(message).toBe(
            '2 books are now on Shelf 3: 1 placed on Shelf 3 · 1 moved from Hallway – Shelf 1. 1 already there.',
        );
    });
    it('says when every chosen book was already on the shelf', () => {
        const message = ShelfPlacement.done(
            { shelf, placed: [], moved: [], unchanged: [{ id: 'c', title: 'C' }] },
            t,
            'en-GB',
        );

        expect(message).toBe('Every chosen book was already on Shelf 3.');
    });
});
