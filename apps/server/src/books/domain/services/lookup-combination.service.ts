import { NameKey } from '../../../shared/domain/name-key.helper.js';
import type {
    LookupAnswer,
    LookupDate,
    LookupSeries,
} from '../value-objects/lookup-answer.value-object.js';

// One value offered for a field, with the sources that gave it (equivalent values merged).
export interface LookupChoice<T> {
    value: T;
    sources: string[];
}

// Every field's choices, the preferred source's value first. An empty list: no source knew it.
export interface CombinedLookup {
    title: LookupChoice<string>[];
    authors: LookupChoice<string[]>[];
    publisher: LookupChoice<string>[];
    publicationDate: LookupChoice<LookupDate>[];
    pageCount: LookupChoice<number>[];
    summary: LookupChoice<string>[];
    collection: LookupChoice<LookupSeries>[];
}

// Combines the answers of several sources, added in order of preference (book entry rules,
// "Lookup sources"): a field missing from one source is completed by the next; different values
// become alternatives behind the preferred one; values that differ only by case, accents,
// punctuation or author name order count as the same.
export class LookupCombination {
    private readonly answers: { source: string; answer: LookupAnswer }[] = [];

    add(source: string, answer: LookupAnswer): void {
        this.answers.push({ source, answer });
    }

    get found(): boolean {
        return this.answers.some(({ answer }) => !answer.empty);
    }

    result(): CombinedLookup {
        return {
            title: this.choices(
                (answer) => answer.title,
                (title) => LookupCombination.words(title),
            ),
            authors: this.choices(
                (answer) => (answer.authors.length > 0 ? [...answer.authors] : null),
                (authors) =>
                    authors
                        .map((name) => LookupCombination.words(name).split(' ').sort().join(' '))
                        .sort()
                        .join('|'),
            ),
            publisher: this.choices(
                (answer) => answer.publisher,
                (publisher) => LookupCombination.words(publisher),
            ),
            publicationDate: this.choices(
                (answer) => answer.publicationDate,
                (date) => date.year + '-' + (date.month ?? ''),
            ),
            pageCount: this.choices(
                (answer) => answer.pageCount,
                (count) => String(count),
            ),
            summary: this.choices(
                (answer) => this.summaryInEditionLanguage(answer),
                (text) => LookupCombination.words(text),
            ),
            collection: this.choices(
                (answer) => answer.series,
                (series) => LookupCombination.words(series.name) + '#' + series.volume,
            ),
        };
    }

    // The edition's language, as the most preferred source that knows it says.
    private get editionLanguage(): string | null {
        const known = this.answers.find(({ answer }) => answer.editionLanguage);

        return known ? LookupCombination.language(known.answer.editionLanguage!) : null;
    }

    // A summary is kept only in the edition's language; when either is unknown it is left out.
    private summaryInEditionLanguage(answer: LookupAnswer): string | null {
        const edition = this.editionLanguage;

        if (!answer.summary?.language || !edition) {
            return null;
        }

        return LookupCombination.language(answer.summary.language) === edition
            ? answer.summary.text
            : null;
    }

    private choices<T>(
        read: (answer: LookupAnswer) => T | null,
        key: (value: T) => string,
    ): LookupChoice<T>[] {
        const choices: (LookupChoice<T> & { key: string })[] = [];

        for (const { source, answer } of this.answers) {
            const value = read(answer);

            if (value === null) {
                continue;
            }

            const valueKey = key(value);
            const same = choices.find((choice) => choice.key === valueKey);

            if (same) {
                same.sources.push(source);
            } else {
                choices.push({ value, sources: [source], key: valueKey });
            }
        }

        return choices.map(({ value, sources }) => ({ value, sources }));
    }

    // Case, accents and punctuation ignored: "Rose hip Rose. 1" and "Rose Hip Rose 1" match.
    private static words(value: string): string {
        return NameKey.of(value)
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim();
    }

    // Two- and three-letter codes of the same language compare equal ("fr", "fre", "fra").
    private static language(code: string): string {
        return LookupCombination.languages[code] ?? code;
    }

    private static readonly languages: Record<string, string> = {
        fr: 'fr',
        fre: 'fr',
        fra: 'fr',
        en: 'en',
        eng: 'en',
        ja: 'ja',
        jpn: 'ja',
        de: 'de',
        ger: 'de',
        deu: 'de',
        es: 'es',
        spa: 'es',
        it: 'it',
        ita: 'it',
        nl: 'nl',
        dut: 'nl',
        nld: 'nl',
        pt: 'pt',
        por: 'pt',
        ko: 'ko',
        kor: 'ko',
        zh: 'zh',
        chi: 'zh',
        zho: 'zh',
    };
}
