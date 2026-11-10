import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const web = new URL('../../apps/web/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, web), 'utf8');

it('links the favicon, the home-screen icon and the manifest from the Leaf page', () => {
    const page = read('leaf/index.html');

    const links = [
        page.includes('<link href="/leaf.svg" rel="icon" type="image/svg+xml" />'),
        page.includes('<link href="/leaf-icon-180.png" rel="apple-touch-icon" />'),
        page.includes('<link href="/leaf.webmanifest" rel="manifest" />'),
    ];

    expect(links).toEqual([true, true, true]);
});
it('lists the home-screen icons in the manifest, scoped to Leaf', () => {
    const manifest = JSON.parse(read('public/leaf.webmanifest'));

    const listed = manifest.icons.map((icon: { src: string }) => icon.src);

    expect([manifest.start_url, manifest.scope, listed]).toEqual([
        '/leaf/',
        '/leaf/',
        ['/leaf-icon-192.png', '/leaf-icon-512.png', '/leaf.svg'],
    ]);
});
it('ships every icon file the Leaf page and manifest name', () => {
    const files = ['leaf.svg', 'leaf-icon-180.png', 'leaf-icon-192.png', 'leaf-icon-512.png'];

    const missing = files.filter((file) => !existsSync(new URL('public/' + file, web)));

    expect(missing).toEqual([]);
});
it('draws the favicon in Spring green', () => {
    const svg = read('public/leaf.svg');

    const colours = [...svg.matchAll(/#[0-9a-f]{6}/gi)].map((match) => match[0].toLowerCase());

    expect([...new Set(colours)]).toEqual(['#79d670']);
});
