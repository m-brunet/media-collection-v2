import type { Language } from './translator.util';

export class LanguageResolver {
    static fromDevice(languages: readonly string[]): Language {
        const first = languages[0]?.toLowerCase() ?? '';

        return first === 'fr' || first.startsWith('fr-') ? 'fr' : 'en';
    }

    static parse(value: string | null | undefined): Language | null {
        return value === 'en' || value === 'fr' ? value : null;
    }

    static resolve(
        account: Language | null,
        stored: Language | null,
        device: readonly string[],
    ): Language {
        return account ?? stored ?? LanguageResolver.fromDevice(device);
    }
}
