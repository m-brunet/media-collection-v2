import { describe, expect, it } from 'vitest';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { en } from '../../shared/i18n/catalog-en';
import { fr } from '../../shared/i18n/catalog-fr';
import type { MessageValues } from '../../shared/i18n/translator.util';
import { Translator } from '../../shared/i18n/translator.util';
import { VolumeCatalogues } from './volume-catalogues.util';

const english = new Translator('en', en);
const french = new Translator('fr', fr);
const t = (key: MessageKey, values?: MessageValues) => english.translate(key, values);
const tFr = (key: MessageKey, values?: MessageValues) => french.translate(key, values);

describe('VolumeCatalogues', () => {
    it('says the volumes were found in one catalogue', () => {
        const sentence = VolumeCatalogues.found(['sudoc'], 3, t);

        expect(sentence).toBe(
            'Found in the Sudoc catalogue from the edition of volume 3. Nothing is saved before you confirm.',
        );
    });
    it('says the volumes were found in both catalogues, in French', () => {
        const sentence = VolumeCatalogues.found(['bnf', 'sudoc'], 3, tFr);

        expect(sentence).toBe(
            'Trouvés dans les catalogues de la BnF et du Sudoc à partir de l’édition du tome 3. Rien n’est enregistré avant votre confirmation.',
        );
    });
    it('names the BnF when the answer names no known catalogue', () => {
        const sentence = VolumeCatalogues.credit(['other'], t);

        expect(sentence).toBe('Source: BnF catalogue (Licence Ouverte).');
    });
    it('credits one catalogue, in French', () => {
        const sentence = VolumeCatalogues.credit(['sudoc'], tFr);

        expect(sentence).toBe('Source : catalogue du Sudoc (Licence Ouverte).');
    });
    it('credits both catalogues, in French', () => {
        const sentence = VolumeCatalogues.credit(['bnf', 'sudoc'], tFr);

        expect(sentence).toBe('Sources : catalogues de la BnF et du Sudoc (Licence Ouverte).');
    });
    it('says one catalogue cannot be reached, in French', () => {
        const sentence = VolumeCatalogues.unavailable(['bnf'], tFr);

        expect(sentence).toBe(
            'Le catalogue de la BnF est injoignable pour le moment. Réessayez dans quelques minutes.',
        );
    });
    it('says both catalogues cannot be reached, in French', () => {
        const sentence = VolumeCatalogues.unavailable(['bnf', 'sudoc'], tFr);

        expect(sentence).toBe(
            'Les catalogues de la BnF et du Sudoc sont injoignables pour le moment. Réessayez dans quelques minutes.',
        );
    });
    it('warns about nothing when every catalogue answered', () => {
        const sentence = VolumeCatalogues.incomplete([], t);

        expect(sentence).toBeNull();
    });
    it('warns that a catalogue could not answer, in French', () => {
        const sentence = VolumeCatalogues.incomplete(['sudoc'], tFr);

        expect(sentence).toBe(
            'Le catalogue du Sudoc n’a pas pu répondre : des tomes peuvent manquer dans cette liste.',
        );
    });
    it('says which catalogue suggests a title, in French', () => {
        const sentence = VolumeCatalogues.suggests('sudoc', 'La vierge de fer', tFr);

        expect(sentence).toBe('Le Sudoc propose : La vierge de fer');
    });
    it('names the BnF for a suggestion without a known catalogue', () => {
        const sentence = VolumeCatalogues.suggests(null, 'La vierge de fer', t);

        expect(sentence).toBe('BnF suggests: La vierge de fer');
    });
});
