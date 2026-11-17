import type { SeriesLookup, SeriesReply } from './series-lookup.service.js';
import type { OwnedVolume, VolumeEdition } from '../../domain/services/series-volumes.service.js';
import { SeriesVolumes } from '../../domain/services/series-volumes.service.js';

export type SeriesFinding = { source: string; editions: VolumeEdition[] };

export type SeriesUnavailable = { name: string; retryAt: Date | null };

export type SeriesSearchResult = {
    anchor: { source: string; edition: VolumeEdition } | null;
    found: ReadonlyMap<number, SeriesFinding>;
    unavailable: SeriesUnavailable[];
};

export class SeriesSearch {
    constructor(private readonly catalogues: readonly SeriesLookup[]) {}

    async find(
        owned: readonly OwnedVolume[],
        wanted: readonly number[],
        signal?: AbortSignal,
    ): Promise<SeriesSearchResult> {
        const found = new Map<number, SeriesFinding>();
        const unavailable: SeriesUnavailable[] = [];
        let anchor: SeriesSearchResult['anchor'] = null;

        for (const catalogue of this.catalogues) {
            if (anchor && wanted.every((volume) => found.has(volume))) {
                break;
            }

            anchor ??= await this.anchor(catalogue, owned, unavailable, signal);

            if (!anchor) {
                continue;
            }

            const { edition } = anchor;
            const records = await catalogue.volumes(
                edition.answer.series?.name ?? '',
                edition.answer.publisher ?? '',
                signal,
            );

            if (records.kind !== 'found') {
                SeriesSearch.note(unavailable, catalogue.name, records);

                continue;
            }

            const volumes = SeriesVolumes.of(edition, records.value);

            for (const volume of wanted.filter((number) => !found.has(number))) {
                const editions = volumes.editions(volume);

                if (editions.length > 0) {
                    found.set(volume, { source: catalogue.name, editions });
                }
            }
        }

        return { anchor, found, unavailable };
    }

    private async anchor(
        catalogue: SeriesLookup,
        owned: readonly OwnedVolume[],
        unavailable: SeriesUnavailable[],
        signal: AbortSignal | undefined,
    ): Promise<SeriesSearchResult['anchor']> {
        const editions = await catalogue.editions(
            owned.map((volume) => volume.isbn13),
            signal,
        );

        if (editions.kind !== 'found') {
            SeriesSearch.note(unavailable, catalogue.name, editions);

            return null;
        }

        const edition = SeriesVolumes.anchorOf(editions.value, owned);

        return edition ? { source: catalogue.name, edition } : null;
    }

    private static note(
        unavailable: SeriesUnavailable[],
        name: string,
        reply: Exclude<SeriesReply, { kind: 'found' }>,
    ): void {
        if (reply.kind === 'none') {
            return;
        }

        unavailable.push({
            name,
            retryAt: reply.kind === 'limited' && reply.retryAt ? reply.retryAt : null,
        });
    }
}
