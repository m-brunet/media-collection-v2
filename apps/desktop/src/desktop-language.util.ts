export type DesktopLanguageCode = 'en' | 'fr';

export class DesktopLanguage {
    static of(preferredLanguages: readonly string[]): DesktopLanguageCode {
        return preferredLanguages[0]?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
    }
}
