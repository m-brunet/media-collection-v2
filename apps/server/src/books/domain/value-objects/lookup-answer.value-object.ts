import type { BookCategory } from '../entities/book.entity.js';

export interface LookupSeries {
    name: string;
    volume: number;
}

export interface LookupSummary {
    text: string;
    language: string | null;
}

export interface LookupDate {
    year: number;
    month: number | null;
}

export interface LookupAnswerFields {
    title?: string | null;
    authors?: readonly string[];
    publisher?: string | null;
    publisherCollection?: string | null;
    publicationDate?: LookupDate | null;
    pageCount?: number | null;
    summary?: LookupSummary | null;
    editionLanguage?: string | null;
    series?: LookupSeries | null;
    category?: BookCategory | null;
}

export class LookupAnswer {
    private constructor(
        readonly title: string | null,
        readonly authors: readonly string[],
        readonly publisher: string | null,
        readonly publisherCollection: string | null,
        readonly publicationDate: LookupDate | null,
        readonly pageCount: number | null,
        readonly summary: LookupSummary | null,
        readonly editionLanguage: string | null,
        readonly series: LookupSeries | null,
        readonly category: BookCategory | null,
    ) {
        Object.freeze(this);
    }

    static of(fields: LookupAnswerFields): LookupAnswer {
        const authors = [
            ...new Set(
                (fields.authors ?? [])
                    .map((name) => LookupAnswer.cleaned(name))
                    .filter((name): name is string => name !== null),
            ),
        ];
        const summaryText = LookupAnswer.text(fields.summary?.text);

        return new LookupAnswer(
            LookupAnswer.cleaned(fields.title),
            authors,
            LookupAnswer.cleaned(fields.publisher),
            LookupAnswer.cleaned(fields.publisherCollection),
            LookupAnswer.date(fields.publicationDate),
            LookupAnswer.positive(fields.pageCount),
            summaryText
                ? { text: summaryText, language: LookupAnswer.language(fields.summary?.language) }
                : null,
            LookupAnswer.language(fields.editionLanguage),
            LookupAnswer.series(fields.series),
            LookupAnswer.categories.find((category) => category === fields.category) ?? null,
        );
    }

    withAuthors(authors: readonly string[]): LookupAnswer {
        return LookupAnswer.of({ ...this, authors });
    }

    withPublishers(spelling: (publisher: string) => string): LookupAnswer {
        return LookupAnswer.of({
            ...this,
            publisher: this.publisher === null ? null : spelling(this.publisher),
            publisherCollection:
                this.publisherCollection === null ? null : spelling(this.publisherCollection),
        });
    }

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

    private static readonly categories: readonly BookCategory[] = ['books', 'manga', 'comics'];

    private static readonly abbreviations: readonly string[] = [
        'éd',
        'ed',
        'cie',
        'co',
        'inc',
        'ltd',
        'jr',
        'sr',
    ];

    private static text(value: string | null | undefined): string | null {
        const trimmed = value?.replace(/\s+/g, ' ').trim();

        return trimmed ? trimmed : null;
    }

    private static cleaned(value: string | null | undefined): string | null {
        let name = LookupAnswer.text(value) ?? '';

        for (;;) {
            const shorter = LookupAnswer.withoutEnding(name);

            if (shorter === name) {
                return name ? name : null;
            }

            name = shorter;
        }
    }

    private static withoutEnding(name: string): string {
        if (/[:;/=,]$/u.test(name)) {
            return name.slice(0, -1).trimEnd();
        }

        if (!name.endsWith('.') || name.endsWith('..')) {
            return name;
        }

        const word = /\p{L}+$/u.exec(name.slice(0, -1))?.[0].toLowerCase() ?? '';

        return word.length === 1 || LookupAnswer.abbreviations.includes(word)
            ? name
            : name.slice(0, -1).trimEnd();
    }

    private static positive(value: number | null | undefined): number | null {
        return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
    }

    private static date(value: LookupDate | null | undefined): LookupDate | null {
        if (!value || !Number.isInteger(value.year) || value.year < 1 || value.year > 9999) {
            return null;
        }

        const { month: candidate } = value;
        const month =
            typeof candidate === 'number' &&
            Number.isInteger(candidate) &&
            candidate >= 1 &&
            candidate <= 12
                ? candidate
                : null;

        return { year: value.year, month };
    }

    private static language(value: string | null | undefined): string | null {
        const code = value?.trim().toLowerCase();

        return code && /^[a-z]{2,3}$/.test(code) ? code : null;
    }

    private static series(value: LookupSeries | null | undefined): LookupSeries | null {
        const name = LookupAnswer.cleaned(value?.name);

        return name && value && Number.isInteger(value.volume) && value.volume >= 0
            ? { name, volume: value.volume }
            : null;
    }
}
