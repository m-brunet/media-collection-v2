import type { IconSetName } from '../../../../../packages/contracts/src/http';

export type ArtworkSet = Exclude<IconSetName, 'lucide'>;

// The artwork of the icon sets 01-05: one static file per set (`/icon-sets/<set>.json`, purpose →
// SVG), copied from the design and recoloured to the colour scheme by tools/import-icon-sets.mjs.
export class IconArtwork {
    static source = async (set: ArtworkSet): Promise<Record<string, string>> => {
        const response = await fetch('/icon-sets/' + set + '.json');

        if (!response.ok) {
            throw new Error('The ' + set + ' icon set could not be loaded.');
        }

        return (await response.json()) as Record<string, string>;
    };
    private static readonly loaded = new Map<ArtworkSet, Map<string, string>>();
    private static readonly loading = new Map<ArtworkSet, Promise<Map<string, string>>>();

    static ready(set: ArtworkSet): Map<string, string> | null {
        return IconArtwork.loaded.get(set) ?? null;
    }

    // A failed load is forgotten, so a later attempt tries again.
    static load(set: ArtworkSet): Promise<Map<string, string>> {
        const pending =
            IconArtwork.loading.get(set) ??
            IconArtwork.fetch(set).catch((error: unknown) => {
                IconArtwork.loading.delete(set);
                throw error;
            });

        IconArtwork.loading.set(set, pending);

        return pending;
    }

    private static async fetch(set: ArtworkSet): Promise<Map<string, string>> {
        const artwork = new Map(Object.entries(await IconArtwork.source(set)));

        IconArtwork.loaded.set(set, artwork);

        return artwork;
    }
}
