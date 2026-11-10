import { expect, it } from 'vitest';
import { DesktopLanguage } from './desktop-language.util.js';

it('chooses French for a French system language', () => {
    const languages = ['fr-FR', 'en-US'];

    const result = DesktopLanguage.of(languages);

    expect(result).toBe('fr');
});
it('chooses French for a regional French variant written in capitals', () => {
    const languages = ['FR-CA'];

    const result = DesktopLanguage.of(languages);

    expect(result).toBe('fr');
});
it('chooses English for any other first language', () => {
    const languages = ['de-DE', 'fr-FR'];

    const result = DesktopLanguage.of(languages);

    expect(result).toBe('en');
});
it('chooses English when the system gives no language', () => {
    const languages: string[] = [];

    const result = DesktopLanguage.of(languages);

    expect(result).toBe('en');
});
