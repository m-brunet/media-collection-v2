import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../../apps/web/public/libris.svg', import.meta.url), 'utf8');

it('draws the Libris icon in Spring green with a dark grey halo', () => {
    const colours = [...svg.matchAll(/#[0-9a-f]{6}/gi)].map((match) => match[0].toLowerCase());

    const used = [...new Set(colours)];

    expect(used).toEqual(['#1b1d1f', '#79d670']);
});
it('draws the halo under the green drawing', () => {
    const order = svg.indexOf('fill="#1b1d1f"') - svg.indexOf('fill="#79d670"');

    expect(order).toBeLessThan(0);
});
it('keeps the icon size the generator expects', () => {
    const size = svg.match(/width="(\d+)" height="(\d+)"/)?.slice(1);

    expect(size).toEqual(['24', '24']);
});
