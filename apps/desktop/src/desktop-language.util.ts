export type DesktopLanguageCode = 'en' | 'fr';

// The device language, not the signed-in person's: these texts also appear before sign-in and the
// main process has no access to accounts.
export class DesktopLanguage {
    static of(preferredLanguages: readonly string[]): DesktopLanguageCode {
        return preferredLanguages[0]?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
    }
}
