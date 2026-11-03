import { expect, it } from 'vitest';
import { en } from './catalog-en';
import { fr } from './catalog-fr';
import { Translator } from './translator.util';

it('translates a key into English', () => {
    const translator = new Translator('en', en);

    const result = translator.translate('signIn.title');

    expect(result).toBe('Sign in');
});

it('translates a key into French', () => {
    const translator = new Translator('fr', fr);

    const result = translator.translate('signIn.title');

    expect(result).toBe('Connexion');
});

it('fills named placeholders', () => {
    const translator = new Translator('en', en);

    const result = translator.translate('server.httpsRunning', { port: 3443 });

    expect(result).toBe('HTTPS is running on port 3443.');
});

it('leaves an unknown placeholder visible rather than inventing text', () => {
    const translator = new Translator('en', en);

    const result = translator.translate('server.httpsRunning');

    expect(result).toBe('HTTPS is running on port {port}.');
});

it('uses a French locale for French formatting', () => {
    const translator = new Translator('fr', fr);

    const result = translator.locale;

    expect(result).toBe('fr-FR');
});

it('defines every English text in French', () => {
    const english = Object.keys(en).sort();

    const french = Object.keys(fr).sort();

    expect(french).toEqual(english);
});

it('keeps the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');

    const mismatches = Object.keys(en).filter(
        (key) =>
            placeholders(en[key as keyof typeof en]) !== placeholders(fr[key as keyof typeof fr]),
    );

    expect(mismatches).toEqual([]);
});
