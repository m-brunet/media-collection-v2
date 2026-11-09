// Copies the design's icon sets 01-05 (design/artifact/icons, Git-ignored) into the web app's
// static files (apps/web/public/icon-sets, one JSON file per set: purpose -> SVG) so the
// installation-wide icon set can switch them (KI-6). The app fetches the chosen set once.
//
//   node tools/import-icon-sets.mjs
//
// The artwork's colours become the colour scheme's (the user's choice, 2026-11-09): green and the
// blueprint blue become the accent, grey the secondary text colour, gold and orange the warning
// colour; `currentColor` already follows the text. SVG presentation attributes cannot hold CSS
// variables, so those colours move into inline `style`. Internal ids (masks, patterns) are
// prefixed per icon so two icons on one page never share an id. Set 00 (Lucide) is not copied:
// the app draws it with lucide-react.
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
const colours = {
    '#86d39a': 'var(--color-accent)',
    '#87cf9b': 'var(--color-accent)',
    '#a3d9e0': 'var(--color-accent)',
    '#a6d4da': 'var(--color-accent)',
    '#a9b5ac': 'var(--color-text-secondary)',
    '#c7d5cc': 'var(--color-text-secondary)',
    '#d5b66f': 'var(--color-warning)',
    '#e7b27c': 'var(--color-warning)',
};

function recolour(svg, file) {
    return svg.replace(
        /<([a-zA-Z][\w:-]*)(\s[^<>]*?)?(\/?)>/g,
        (tag, name, attributes = '', close) => {
            const styles = [];
            let rest = attributes.replace(
                /\s(fill|stroke|stop-color)="(#[0-9a-fA-F]{3,6})"/g,
                (_, property, value) => {
                    const variable = colours[value.toLowerCase()];

                    if (!variable) {
                        throw new Error(
                            file + ': unknown colour ' + value + ', add it to the colour map.',
                        );
                    }

                    styles.push(property + ':' + variable);

                    return '';
                },
            );

            if (!styles.length) {
                return tag;
            }

            const style = rest.match(/\sstyle="([^"]*)"/);

            rest = style
                ? rest.replace(
                      style[0],
                      ' style="' + style[1].replace(/;?$/, ';') + styles.join(';') + '"',
                  )
                : rest + ' style="' + styles.join(';') + '"';

            return '<' + name + rest + close + '>';
        },
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

// The app sizes icons itself: drop fixed sizes, descriptions and the root colour.
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
