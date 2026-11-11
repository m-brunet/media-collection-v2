import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'design', 'artifact', 'icons');
const target = join(root, 'apps', 'web', 'public', 'icon-sets');
const previous = join(root, 'apps', 'web', 'src', 'shared', 'ui', 'icon-sets');
const sets = {
    '01-solid-silhouettes': 'solid-silhouettes',
    '02-hand-inked-editorial': 'hand-inked-editorial',
    '03-architectural-wireframes': 'architectural-wireframes',
    '04-single-ink-risograph': 'single-ink-risograph',
    '05-quiet-editorial-monoline': 'quiet-editorial-monoline',
};
const known = [
    '#86d39a',
    '#87cf9b',
    '#a3d9e0',
    '#a6d4da',
    '#a9b5ac',
    '#c7d5cc',
    '#d5b66f',
    '#e7b27c',
];
const colourAttribute = /\s(fill|stroke)="(#[0-9a-fA-F]{6})"/g;
const secondTone = '0.6';

function recolour(svg, file) {
    const counts = new Map();

    for (const [, , value] of svg.matchAll(colourAttribute)) {
        const colour = value.toLowerCase();

        if (!known.includes(colour)) {
            throw new Error(file + ': unknown colour ' + value + ', add it to the known colours.');
        }

        counts.set(colour, (counts.get(colour) ?? 0) + 1);
    }

    const main = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];

    return svg.replace(colourAttribute, (attribute, property, value) =>
        value.toLowerCase() === main
            ? ' ' + property + '="currentColor"'
            : ' ' + property + '="currentColor" ' + property + '-opacity="' + secondTone + '"',
    );
}

function prefixIds(svg, prefix) {
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    let result = svg;

    for (const id of ids) {
        const unique = prefix + '-' + id;

        result = result
            .replaceAll('id="' + id + '"', 'id="' + unique + '"')
            .replaceAll('url(#' + id + ')', 'url(#' + unique + ')')
            .replaceAll('href="#' + id + '"', 'href="#' + unique + '"');
    }

    return result;
}

function tidy(svg) {
    return svg
        .replace(/<\?xml[^>]*>\s*/g, '')
        .replace(/<desc>[\s\S]*?<\/desc>/g, '')
        .replace(/<title>[\s\S]*?<\/title>/g, '')
        .replace(
            /<svg([^>]*)>/,
            (tag, attributes) =>
                '<svg' +
                attributes
                    .replace(/\s(width|height|color)="[^"]*"/g, '')
                    .replace(/\saria-hidden="[^"]*"/g, '') +
                ' aria-hidden="true" focusable="false">',
        )
        .trim();
}

rmSync(previous, { recursive: true, force: true });
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

for (const [folder, name] of Object.entries(sets)) {
    const artwork = {};

    for (const file of readdirSync(join(source, folder))
        .filter((entry) => entry.endsWith('.svg'))
        .sort()) {
        const purpose = file.replace(/\.svg$/, '');
        const svg = readFileSync(join(source, folder, file), 'utf8');

        artwork[purpose] = tidy(
            prefixIds(recolour(svg, folder + '/' + file), name + '-' + purpose),
        );
    }

    writeFileSync(join(target, name + '.json'), JSON.stringify(artwork, null, 4) + '\n');
}

copyFileSync(join(source, 'CREDITS.md'), join(target, 'CREDITS.md'));
console.log('Icon sets copied to ' + target);
