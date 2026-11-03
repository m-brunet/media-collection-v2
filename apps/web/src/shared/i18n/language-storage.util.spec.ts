import { afterEach, expect, it, vi } from 'vitest';
import { LanguageStorage } from './language-storage.util';

afterEach(() => {
    vi.unstubAllGlobals();
});

function storage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));

    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
    };
}

it('reads a language chosen earlier on this device', () => {
    vi.stubGlobal('window', { localStorage: storage({ 'media-collection.language': 'fr' }) });

    const result = LanguageStorage.read();

    expect(result).toBe('fr');
});

it('ignores an unsupported stored value', () => {
    vi.stubGlobal('window', { localStorage: storage({ 'media-collection.language': 'xx' }) });

    const result = LanguageStorage.read();

    expect(result).toBeNull();
});

it('remembers a chosen language', () => {
    const local = storage();

    vi.stubGlobal('window', { localStorage: local });

    LanguageStorage.write('fr');

    expect(local.getItem('media-collection.language')).toBe('fr');
});

it('treats unavailable browser storage as no choice', () => {
    vi.stubGlobal('window', {
        get localStorage(): Storage {
            throw new Error('Storage disabled');
        },
    });

    const result = LanguageStorage.read();

    expect(result).toBeNull();
});
