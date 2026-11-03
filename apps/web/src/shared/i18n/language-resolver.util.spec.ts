import { expect, it } from 'vitest';
import { LanguageResolver } from './language-resolver.util';

it('uses French for a French device', () => {
    const device = ['fr-FR', 'en-US'];

    const result = LanguageResolver.fromDevice(device);

    expect(result).toBe('fr');
});

it('uses French for a plain French device language', () => {
    const device = ['fr'];

    const result = LanguageResolver.fromDevice(device);

    expect(result).toBe('fr');
});

it('uses English for an English device', () => {
    const device = ['en-GB'];

    const result = LanguageResolver.fromDevice(device);

    expect(result).toBe('en');
});

it('falls back to English for an unsupported device language', () => {
    const device = ['de-DE', 'fr-FR'];

    const result = LanguageResolver.fromDevice(device);

    expect(result).toBe('en');
});

it('falls back to English when the device reports no language', () => {
    const device: string[] = [];

    const result = LanguageResolver.fromDevice(device);

    expect(result).toBe('en');
});

it('prefers the account language over every other choice', () => {
    const device = ['en-GB'];

    const result = LanguageResolver.resolve('fr', 'en', device);

    expect(result).toBe('fr');
});

it('uses the language chosen on this device before signing in', () => {
    const device = ['en-GB'];

    const result = LanguageResolver.resolve(null, 'fr', device);

    expect(result).toBe('fr');
});

it('uses the device language when nothing was chosen', () => {
    const device = ['fr-CA'];

    const result = LanguageResolver.resolve(null, null, device);

    expect(result).toBe('fr');
});

it('accepts only supported stored languages', () => {
    const stored = 'de';

    const result = LanguageResolver.parse(stored);

    expect(result).toBeNull();
});
