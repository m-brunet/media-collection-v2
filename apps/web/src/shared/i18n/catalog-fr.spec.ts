import { describe, expect, it } from 'vitest';
import type { MessageKey } from './catalog-en';
import { en } from './catalog-en';
import { fr } from './catalog-fr';
import { Translator } from './translator.util';

const french = new Translator('fr', fr);

function texts(...keys: MessageKey[]): string[] {
    return keys.map((key) => french.translate(key));
}

describe('French catalogue', () => {
    it('calls the furniture a rayonnage in the menu, the page and its actions', () => {
        const shown = texts(
            'nav.bookshelves',
            'bookshelves.title',
            'bookcase.create',
            'bookcase.name',
            'bookcase.rename',
            'bookcase.delete',
            'addBooks.backToBookshelves',
        );

        expect(shown).toEqual([
            'Rayonnages',
            'Rayonnages',
            'Nouveau rayonnage',
            'Nom du rayonnage',
            'Renommer le rayonnage',
            'Supprimer le rayonnage',
            'Retour aux rayonnages',
        ]);
    });
    it('agrees the sentences about a rayonnage in the masculine', () => {
        const shown = [
            french.translate('bookcase.created', { name: 'Salon' }),
            french.translate('bookcase.deleted', { name: 'Salon' }),
            french.translate('bookcase.deleteBodyNone'),
            french.translate('bookshelves.emptyGuest'),
            french.translate('shelf.moveBody'),
        ];

        expect(shown).toEqual([
            '« Salon » a été créé.',
            '« Salon » a été supprimé. Ses livres ont été conservés.',
            'Aucun livre ne sera supprimé. Le rayonnage sera retiré.',
            'Aucun rayonnage n’a encore été créé.',
            'L’étagère garde ses livres dans son nouveau rayonnage. La destination ne doit pas déjà avoir une étagère au nom équivalent.',
        ]);
    });
    it('calls the furniture a rayonnage in the location field, the filters and the errors', () => {
        const shown = texts(
            'location.bookcase',
            'location.shelfRequired',
            'filters.anyLocation',
            'filters.kind.bookcase',
            'reason.bookcaseNameTaken',
            'reason.shelfNameTaken',
        );

        expect(shown).toEqual([
            'Rayonnage',
            'Choisissez une étagère de ce rayonnage, ou laissez le rayonnage non attribué.',
            'Tous les rayonnages / étagères',
            'un rayonnage',
            'Un autre rayonnage a déjà un nom équivalent.',
            'Ce rayonnage a déjà une étagère au nom équivalent.',
        ]);
    });
    it('calls the furniture a rayonnage in Overview, Activity and the data reset', () => {
        const shown = [
            french.translate('overview.bookcases'),
            french.translate('overview.noBookcases'),
            french.translate('activity.bookcaseCreated', { name: 'Salon' }),
            french.translate('activity.bookcaseRenamed', { from: 'Salon', to: 'Bureau' }),
            french.translate('activity.bookcaseDeleted', { name: 'Salon' }),
        ];

        expect(shown).toEqual([
            'Rayonnages et étagères',
            'Aucun rayonnage pour l’instant.',
            'Vous avez créé le rayonnage Salon',
            'Vous avez renommé le rayonnage Salon en Bureau',
            'Vous avez supprimé le rayonnage Salon',
        ]);
        expect(french.translate('dataReset.body')).toContain('collections, rayonnages, étiquettes');
    });
    it('keeps bibliothèque for the Library page and the household library', () => {
        const shown = texts('nav.books', 'books.title', 'nav.library', 'details.back');

        expect(shown).toEqual([
            'Bibliothèque',
            'Bibliothèque',
            'Bibliothèque partagée',
            'Retour à la bibliothèque',
        ]);
    });
    it('says bibliothèque in no text about bookcases, shelves, locations or their filters', () => {
        const furniture = /^(bookcase|bookshelves|shelf|location|addBooks|columns)\.|bookcase/i;

        const remaining = (Object.keys(fr) as MessageKey[]).filter(
            (key) => furniture.test(key) && /biblioth/i.test(fr[key]),
        );

        expect(remaining).toEqual([]);
    });
    it('has the same texts as the English catalogue', () => {
        const keys = Object.keys(fr).sort();

        expect(keys).toEqual(Object.keys(en).sort());
    });
});
