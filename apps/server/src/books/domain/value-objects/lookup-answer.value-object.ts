// A collection and volume a source suggests for the edition.
export interface LookupSeries {
    name: string;
    volume: number;
}

// A summary with the language it is written in, when the source says so.
export interface LookupSummary {
    text: string;
    language: string | null;
}

// A publication date as lookups give it: a full date is reduced to its month and year.
export interface LookupDate {
    year: number;
    month: number | null;
}

export interface LookupAnswerFields {
    title?: string | null;
    authors?: readonly string[];
    publisher?: string | null;
    publicationDate?: LookupDate | null;
    pageCount?: number | null;
    summary?: LookupSummary | null;
    // The language of the edition itself (ISO 639 code, two or three letters).
    editionLanguage?: string | null;
    series?: LookupSeries | null;
}

// What one source knows about an edition, cleaned of empty or unusable values. A source that
// gives an impossible value (a month 13, a page count of zero) simply contributes nothing for it.
export class LookupAnswer {
    private constructor(
        readonly title: string | null,
        readonly authors: readonly string[],
        readonly publisher: string | null,
        readonly publicationDate: LookupDate | null,
        readonly pageCount: number | null,
        readonly summary: LookupSummary | null,
        readonly editionLanguage: string | null,
        readonly series: LookupSeries | null,
    ) {
        Object.freeze(this);
    }

    static of(fields: LookupAnswerFields): LookupAnswer {
        const authors = [
            ...new Set((fields.authors ?? []).map((name) => name.trim()).filter(Boolean)),
        ];
        const summaryText = LookupAnswer.text(fields.summary?.text);

        return new LookupAnswer(
            LookupAnswer.text(fields.title),
            authors,
            LookupAnswer.text(fields.publisher),
            LookupAnswer.date(fields.publicationDate),
            LookupAnswer.positive(fields.pageCount),
            summaryText
                ? { text: summaryText, language: LookupAnswer.language(fields.summary?.language) }
                : null,
            LookupAnswer.language(fields.editionLanguage),
            LookupAnswer.series(fields.series),
        );
    }

    // Nothing usable at all: the source found a record without any of the fields we fill.
    get empty(): boolean {
        return (
            !this.title &&
            this.authors.length === 0 &&
            !this.publisher &&
            !this.publicationDate &&
            !this.pageCount &&
            !this.summary &&
            !this.series
        );
    }

    private static text(value: string | null | undefined): string | null {
        const trimmed = value?.replace(/\s+/g, ' ').trim();

        return trimmed ? trimmed : null;
    }

    private static positive(value: number | null | undefined): number | null {
        return Number.isInteger(value) && value! > 0 ? value! : null;
    }

    private static date(value: LookupDate | null | undefined): LookupDate | null {
        if (!value || !Number.isInteger(value.year) || value.year < 1 || value.year > 9999) {
            return null;
        }

        const month =
            Number.isInteger(value.month) && value.month! >= 1 && value.month! <= 12
                ? value.month!
                : null;

        return { year: value.year, month };
    }

    private static language(value: string | null | undefined): string | null {
        const code = value?.trim().toLowerCase();

        return code && /^[a-z]{2,3}$/.test(code) ? code : null;
    }

    private static series(value: LookupSeries | null | undefined): LookupSeries | null {
        const name = LookupAnswer.text(value?.name);

        return name && Number.isInteger(value!.volume) && value!.volume >= 0
            ? { name, volume: value!.volume }
            : null;
    }
}
