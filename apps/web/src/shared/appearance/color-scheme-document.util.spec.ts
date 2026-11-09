import { afterEach, expect, it, vi } from 'vitest';
import { ColorSchemeDocument } from './color-scheme-document.util';

function page(stored: string | null = null) {
    const values = new Map<string, string>(
        stored ? [['media-collection.color-scheme', stored]] : [],
    );
    const root = { dataset: {} as Record<string, string> };

    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', {
        localStorage: {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        },
    });

    return { root, values };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

it('applies a scheme to the page and remembers it', () => {
    const { root, values } = page();

    ColorSchemeDocument.apply('midnight-blue');

    expect(root.dataset.colorScheme).toBe('midnight-blue');
    expect(values.get('media-collection.color-scheme')).toBe('midnight-blue');
});

it('starts with the scheme remembered in this browser', () => {
    const { root } = page('rose-noir');

    ColorSchemeDocument.restore();

    expect(root.dataset.colorScheme).toBe('rose-noir');
});

it('ignores an unknown remembered scheme', () => {
    const { root } = page('purple');

    ColorSchemeDocument.restore();

    expect(root.dataset.colorScheme).toBeUndefined();
});
