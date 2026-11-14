import type { LookupAnswer } from '../value-objects/lookup-answer.value-object.js';
import { Isbn } from '../value-objects/isbn.value-object.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export type SeriesEntry = {
    isbns: readonly string[];
    subtitle: string | null;
    answer: LookupAnswer;
};

export type VolumeEdition = {
    isbn13: string;
    volume: number;
    subtitle: string | null;
    answer: LookupAnswer;
};

export type OwnedVolume = { isbn13: string; volume: number };

export class SeriesVolumes {
    private constructor(
        private readonly anchor: VolumeEdition,
        private readonly byVolume: ReadonlyMap<number, readonly VolumeEdition[]>,
    ) {}

    static anchorOf(
        entries: readonly SeriesEntry[],
        owned: readonly OwnedVolume[],
    ): VolumeEdition | null {
        const anchors = entries.flatMap((entry) => {
            if (!entry.answer.series || !entry.answer.publisher) {
                return [];
            }

            const isbns = SeriesVolumes.isbns(entry);

            return owned
                .filter((volume) => isbns.includes(volume.isbn13))
                .map((volume) => ({ ...volume, subtitle: entry.subtitle, answer: entry.answer }));
        });

        return anchors.sort((a, b) => b.volume - a.volume)[0] ?? null;
    }

    static of(anchor: VolumeEdition, entries: readonly SeriesEntry[]): SeriesVolumes {
        const series = NameKey.of(anchor.answer.series?.name ?? '');
        const byVolume = new Map<number, VolumeEdition[]>();

        for (const entry of entries) {
            const volume = SeriesVolumes.volume(entry.answer, series);
            const isbn13 = SeriesVolumes.isbns(entry)[0];

            if (volume === null || !isbn13) {
                continue;
            }

            const editions = byVolume.get(volume) ?? [];

            if (!editions.some((edition) => edition.isbn13 === isbn13)) {
                editions.push({ isbn13, volume, subtitle: entry.subtitle, answer: entry.answer });
            }

            byVolume.set(volume, editions);
        }

        return new SeriesVolumes(anchor, byVolume);
    }

    get series(): string {
        return this.anchor.answer.series?.name ?? '';
    }

    editions(volume: number): VolumeEdition[] {
        return [...(this.byVolume.get(volume) ?? [])].sort(
            (a, b) =>
                Number(this.sameSubtitle(b)) - Number(this.sameSubtitle(a)) ||
                this.sharedDigits(b) - this.sharedDigits(a) ||
                this.yearsApart(a) - this.yearsApart(b),
        );
    }

    private sameSubtitle(edition: VolumeEdition): boolean {
        return NameKey.of(edition.subtitle ?? '') === NameKey.of(this.anchor.subtitle ?? '');
    }

    private sharedDigits(edition: VolumeEdition): number {
        let shared = 0;

        while (
            shared < edition.isbn13.length &&
            edition.isbn13[shared] === this.anchor.isbn13[shared]
        ) {
            shared++;
        }

        return shared;
    }

    private yearsApart(edition: VolumeEdition): number {
        const year = edition.answer.publicationDate?.year;
        const anchorYear = this.anchor.answer.publicationDate?.year;

        return year === undefined || anchorYear === undefined
            ? Number.MAX_SAFE_INTEGER
            : Math.abs(year - anchorYear);
    }

    private static volume(answer: LookupAnswer, series: string): number | null {
        if (answer.series) {
            return NameKey.of(answer.series.name) === series ? answer.series.volume : null;
        }

        const title = NameKey.of(answer.title ?? '');
        const number = title.match(/(\d+)$/)?.[1];

        return number !== undefined && title.startsWith(series + ' ') ? Number(number) : null;
    }

    private static isbns(entry: SeriesEntry): string[] {
        return entry.isbns.flatMap((isbn) => Isbn.equivalent(isbn) ?? []);
    }
}
