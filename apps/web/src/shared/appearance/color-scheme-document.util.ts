import type { ColorSchemeName } from '../../../../../packages/contracts/src/http';

// The last scheme seen is remembered in
// this browser so the next page load starts with the right colours instead of flashing.
export class ColorSchemeDocument {
    static readonly names: readonly ColorSchemeName[] = [
        'spring-green',
        'midnight-blue',
        'velvet-violet',
        'ember',
        'rose-noir',
        'graphite-gold',
        'slate-orchid',
        'charcoal-scarlet',
    ];
    private static readonly key = 'media-collection.color-scheme';

    static apply(name: ColorSchemeName): void {
        document.documentElement.dataset.colorScheme = name;

        try {
            window.localStorage.setItem(ColorSchemeDocument.key, name);
        } catch {
            // Storage unavailable: the scheme still applies to this page.
        }
    }

    static restore(): void {
        let stored: string | null = null;

        try {
            stored = window.localStorage.getItem(ColorSchemeDocument.key);
        } catch {
            stored = null;
        }

        if (stored && (ColorSchemeDocument.names as readonly string[]).includes(stored)) {
            document.documentElement.dataset.colorScheme = stored;
        }
    }
}
