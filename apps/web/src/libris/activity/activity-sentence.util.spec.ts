import { describe, expect, it } from 'vitest';
import type { ActivityEventDto } from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { en } from '../../shared/i18n/catalog-en';
import { fr } from '../../shared/i18n/catalog-fr';
import type { MessageValues } from '../../shared/i18n/translator.util';
import { Translator } from '../../shared/i18n/translator.util';
import { ActivitySentence } from './activity-sentence.util';

const english = new Translator('en', en);
const french = new Translator('fr', fr);
const t = (key: MessageKey, values?: MessageValues) => english.translate(key, values);
const tFr = (key: MessageKey, values?: MessageValues) => french.translate(key, values);

describe('ActivitySentence', () => {
    it('says a book was added', () => {
        const event: ActivityEventDto = { kind: 'book-added', title: 'Dune' };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You added Dune');
    });
    it('says a collection and its books changed category', () => {
        const event: ActivityEventDto = {
            kind: 'collection-category-changed',
            name: 'Naruto',
            category: 'manga',
            count: 12,
        };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You changed the collection Naruto and its 12 books to Manga');
    });
    it('says a collection and its single book changed category, in French', () => {
        const event: ActivityEventDto = {
            kind: 'collection-category-changed',
            name: 'Naruto',
            category: 'comics',
            count: 1,
        };

        const sentence = ActivitySentence.main(event, tFr);

        expect(sentence).toBe(
            'Vous avez passé la collection Naruto et son livre dans la catégorie BD et comics',
        );
    });
    it('says a book was marked Owned', () => {
        const event: ActivityEventDto = { kind: 'book-marked-owned', title: 'Dune' };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You marked Dune as Owned');
    });
    it('says a book when the title is unknown', () => {
        const event: ActivityEventDto = { kind: 'book-cover-changed', title: null };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You changed the cover of a book');
    });
    it('names the one book lent', () => {
        const event: ActivityEventDto = { kind: 'books-lent', receiver: 'Sam', titles: ['Dune'] };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You lent Dune to Sam');
    });
    it('counts several books lent together', () => {
        const event: ActivityEventDto = {
            kind: 'books-lent',
            receiver: 'Sam Taylor',
            titles: ['Dune', 'Emma', 'Piranesi'],
        };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You lent 3 books to Sam Taylor');
    });
    it('names the one book returned', () => {
        const event: ActivityEventDto = {
            kind: 'books-returned',
            receiver: 'Sam',
            titles: ['Dune'],
        };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You recorded the return of Dune from Sam');
    });
    it('counts several returns recorded together', () => {
        const event: ActivityEventDto = {
            kind: 'books-returned',
            receiver: 'Sam',
            titles: ['Dune', 'Emma'],
        };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You recorded 2 returns from Sam');
    });
    it('says a collection was renamed', () => {
        const event: ActivityEventDto = {
            kind: 'collection-renamed',
            from: 'Naruto',
            to: 'Boruto',
        };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You renamed the collection Naruto to Boruto');
    });
    it('says a shelf was moved to another bookcase', () => {
        const event: ActivityEventDto = {
            kind: 'shelf-moved',
            name: 'Shelf 3',
            from: 'Pine',
            to: 'Oak',
        };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You moved Shelf 3 to Oak');
    });
    it('says a shelf was created in its bookcase', () => {
        const event: ActivityEventDto = { kind: 'shelf-created', name: 'Top', bookcase: 'Oak' };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You created the shelf Top in Oak');
    });
    it('says a tag was created', () => {
        const event: ActivityEventDto = { kind: 'tag-created', name: 'Fantasy' };

        const sentence = ActivitySentence.main(event, t);

        expect(sentence).toBe('You created the Fantasy tag');
    });
    it('lists the changes an operation caused', () => {
        const events: ActivityEventDto[] = [
            { kind: 'collection-created', name: 'Naruto' },
            { kind: 'tag-created', name: 'Fantasy' },
        ];

        const line = ActivitySentence.also(events, t);

        expect(line).toBe('Also: created the collection Naruto · created the Fantasy tag');
    });
    it('gives no line when nothing else changed', () => {
        const events: ActivityEventDto[] = [];

        const line = ActivitySentence.also(events, t);

        expect(line).toBeNull();
    });
    it('says a lending in French', () => {
        const event: ActivityEventDto = {
            kind: 'books-lent',
            receiver: 'Sam',
            titles: ['Dune', 'Emma'],
        };

        const sentence = ActivitySentence.main(event, tFr);

        expect(sentence).toBe('Vous avez prêté 2 livres à Sam');
    });
    it('says a book added in French', () => {
        const event: ActivityEventDto = { kind: 'book-added', title: 'Dune' };

        const sentence = ActivitySentence.main(event, tFr);

        expect(sentence).toBe('Vous avez ajouté Dune');
    });
    it('lists the changes an operation caused in French', () => {
        const events: ActivityEventDto[] = [{ kind: 'receiver-created', name: 'Sam' }];

        const line = ActivitySentence.also(events, tFr);

        expect(line).toBe('Aussi : ajout de l’emprunteur Sam');
    });
});
