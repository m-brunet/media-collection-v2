import { expect, it } from 'vitest';
import { DesktopTexts } from './desktop-texts.util.js';

it('has the same texts in English and French', () => {
    const catalogue = DesktopTexts.catalogue;

    const french = Object.keys(catalogue.fr).sort();

    expect(french).toEqual(Object.keys(catalogue.en).sort());
});
it('has no empty text in either language', () => {
    const catalogue = DesktopTexts.catalogue;

    const texts = [...Object.values(catalogue.en), ...Object.values(catalogue.fr)];

    expect(texts.every((text) => text.trim().length > 0)).toBe(true);
});
it('gives the English text', () => {
    const texts = new DesktopTexts('en');

    const result = texts.text('serverStoppedTitle');

    expect(result).toBe('Server stopped');
});
it('gives the French text', () => {
    const texts = new DesktopTexts('fr');

    const result = texts.text('serverStoppedTitle');

    expect(result).toBe('Serveur arrêté');
});
