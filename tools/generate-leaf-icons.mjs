// Generates Leaf's home-screen icons from its icon (apps/web/public/leaf.svg, the hand-inked
// Turning leaf in Spring green): PNGs on Leaf's dark background, as phones expect for an app
// icon, and the web app manifest that lists them. The favicon is leaf.svg itself.
// Run with `node tools/generate-leaf-icons.mjs` after changing the SVG, and commit the output.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..');
const publicFolder = join(root, 'apps/web/public');
const svg = await readFile(join(publicFolder, 'leaf.svg'));
// Leaf's sidebar colour (Spring green scheme); the leaf fills 70 % of the square.
const background = '#1b1d1f';
const sizes = { 'leaf-icon-180.png': 180, 'leaf-icon-192.png': 192, 'leaf-icon-512.png': 512 };
// The SVG is drawn at 24 px.
const sourceSize = 24;

async function render(size) {
    const leafSize = Math.round(size * 0.7);
    const leaf = await sharp(svg, { density: (72 * leafSize) / sourceSize })
        .resize(leafSize, leafSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    return sharp({ create: { width: size, height: size, channels: 4, background } })
        .composite([{ input: leaf, gravity: 'center' }])
        .png()
        .toBuffer();
}

for (const [file, size] of Object.entries(sizes)) {
    await writeFile(join(publicFolder, file), await render(size));
}

const manifest = {
    name: 'Leaf',
    short_name: 'Leaf',
    description: 'Media Collection on your phone',
    start_url: '/leaf/',
    scope: '/leaf/',
    display: 'standalone',
    background_color: background,
    theme_color: background,
    icons: [
        { src: '/leaf-icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/leaf-icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/leaf.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
};

await writeFile(join(publicFolder, 'leaf.webmanifest'), JSON.stringify(manifest, null, 4) + '\n');
console.log('Leaf icons written to ' + publicFolder);
