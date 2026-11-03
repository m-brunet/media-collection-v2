import type { MessageKey } from './catalog-en';

export type Language = 'en' | 'fr';
export type Catalog = Record<MessageKey, string>;
export type MessageValues = Record<string, string | number>;

// Looks up interface text in one language and fills `{name}` placeholders.
export class Translator {
    constructor(
        readonly language: Language,
        private readonly catalog: Catalog,
    ) {}

    get locale(): string {
        return this.language === 'fr' ? 'fr-FR' : 'en-GB';
    }

    translate(key: MessageKey, values: MessageValues = {}): string {
        return this.catalog[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
            name in values ? String(values[name]) : placeholder,
        );
    }
}
