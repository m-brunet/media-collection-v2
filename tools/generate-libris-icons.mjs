// Generates the desktop icon files from the official Libris icon (apps/web/public/libris.svg):
// a Windows .ico (PNG-compressed entries) and a 512 px PNG for the other systems.
// Run with `node tools/generate-libris-icons.mjs` after changing the SVG, and commit the output.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..');
const source = join(root, 'apps/web/public/libris.svg');
const output = join(root, 'apps/desktop/assets/icons');
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const pngSize = 512;
const sourceSize = 24;
const svg = await readFile(source);

function render(size) {
    return sharp(svg, { density: (72 * size) / sourceSize })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
}

// ICO layout: 6-byte header, one 16-byte directory entry per image, then the PNG data.
function ico(images) {
    const header = Buffer.alloc(6);

    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);

    let offset = header.length + images.length * 16;
    const entries = images.map(({ size, data }) => {
        const entry = Buffer.alloc(16);

        entry.writeUInt8(size >= 256 ? 0 : size, 0);
        entry.writeUInt8(size >= 256 ? 0 : size, 1);
        entry.writeUInt8(0, 2);
        entry.writeUInt8(0, 3);
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(data.length, 8);
        entry.writeUInt32LE(offset, 12);
        offset += data.length;

        return entry;
    });

    return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

await mkdir(output, { recursive: true });

const images = await Promise.all(
    icoSizes.map(async (size) => ({ size, data: await render(size) })),
);

await writeFile(join(output, 'libris.ico'), ico(images));
await writeFile(join(output, 'libris.png'), await render(pngSize));
console.log('Libris icons written to ' + output);
