import { LanguageResolver } from './language-resolver.util';
import type { Language } from './translator.util';

// Browser storage can be
// unavailable (privacy modes); the interface then simply falls back to the device language.
export class LanguageStorage {
    private static readonly key = 'media-collection.language';

    static read(): Language | null {
        try {
            return LanguageResolver.parse(window.localStorage.getItem(LanguageStorage.key));
        } catch {
            return null;
        }
    }

    static write(language: Language): void {
        try {
            window.localStorage.setItem(LanguageStorage.key, language);
        } catch {
            // Storage unavailable: the choice still applies until the page is closed.
        }
    }
}
