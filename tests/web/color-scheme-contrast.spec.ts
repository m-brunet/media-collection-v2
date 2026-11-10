import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const offered = [
    'spring-green',
    'midnight-blue',
    'velvet-violet',
    'ember',
    'rose-noir',
    'graphite-gold',
    'slate-orchid',
    'charcoal-scarlet',
];
const tokens = readFileSync(
    new URL('../../apps/web/src/shared/ui/tokens.css', import.meta.url),
    'utf8',
);

function palettes(): Map<string, Record<string, string>> {
    const result = new Map<string, Record<string, string>>();

    for (const block of tokens.matchAll(/\[data-color-scheme='([a-z-]+)'\]\s*\{([^}]*)\}/g)) {
        const roles: Record<string, string> = {};

        for (const role of block[2]!.matchAll(/--scheme-([a-z-]+):\s*(#[0-9a-f]{6});/g)) {
            roles[role[1]!] = role[2]!;
        }

        result.set(block[1]!, roles);
    }

    return result;
}

function luminance(hex: string): number {
    return [1, 3, 5]
        .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
        .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
}

function contrast(first: string, second: string): number {
    const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);

    return (light! + 0.05) / (dark! + 0.05);
}

function failures(text: string, surfaces: string[], minimum: number): string[] {
    const found: string[] = [];

    for (const [scheme, roles] of palettes()) {
        for (const surface of surfaces) {
            if (contrast(roles[text]!, roles[surface]!) < minimum) {
                found.push(scheme + ': ' + text + ' on ' + surface);
            }
        }
    }

    return found;
}

const roles = [
    'canvas',
    'sidebar',
    'panel',
    'surface',
    'control',
    'control-hover',
    'border',
    'border-strong',
    'text',
    'text-secondary',
    'text-muted',
    'accent',
    'accent-background',
    'accent-text',
    'on-accent',
];

it('defines a palette for every offered colour scheme', () => {
    const schemes = palettes();

    const defined = [...schemes.keys()];

    expect(defined).toEqual(offered);
});
it('defines every colour role in every scheme', () => {
    const schemes = palettes();

    const incomplete = [...schemes].filter(([, values]) =>
        roles.some((role) => !/^#[0-9a-f]{6}$/.test(values[role] ?? '')),
    );

    expect(incomplete).toEqual([]);
});
it('keeps text readable on every surface (WCAG AA)', () => {
    const surfaces = ['canvas', 'sidebar', 'panel', 'surface', 'control', 'control-hover'];

    const found = failures('text', surfaces, 4.5);

    expect(found).toEqual([]);
});
it('keeps secondary text readable on every surface (WCAG AA)', () => {
    const surfaces = ['canvas', 'sidebar', 'panel', 'surface', 'control'];

    const found = failures('text-secondary', surfaces, 4.5);

    expect(found).toEqual([]);
});
it('keeps muted text readable on every surface (WCAG AA)', () => {
    const surfaces = ['canvas', 'sidebar', 'panel', 'surface', 'control'];

    const found = failures('text-muted', surfaces, 4.5);

    expect(found).toEqual([]);
});
it('keeps accent text readable on the accent background and the surfaces (WCAG AA)', () => {
    const surfaces = ['accent-background', 'canvas', 'panel', 'surface'];

    const found = failures('accent-text', surfaces, 4.5);

    expect(found).toEqual([]);
});
it('keeps text on the accent readable (WCAG AA)', () => {
    const surfaces = ['accent'];

    const found = failures('on-accent', surfaces, 4.5);

    expect(found).toEqual([]);
});
it('keeps the accent visible against the surfaces (WCAG non-text contrast)', () => {
    const surfaces = ['canvas', 'panel', 'surface', 'accent-background'];

    const found = failures('accent', surfaces, 3);

    expect(found).toEqual([]);
});
