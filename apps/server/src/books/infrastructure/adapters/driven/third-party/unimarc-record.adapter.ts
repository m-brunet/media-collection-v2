import type { BookCategory } from '../../../../domain/entities/book.entity.js';
import { LookupAnswer } from '../../../../domain/value-objects/lookup-answer.value-object.js';
import { Required } from '../../../../../shared/domain/required.helper.js';

type Subfields = Map<string, string[]>;
type Fields = Map<string, Subfields[]>;

// A UNIMARC record of the BnF general catalogue. Fields used: 010 ISBN, 101 language (and
// original language), 200 title (subtitle and volume), 210/214 publisher and date, 215 extent, 330
// summary, 461 series and volume, 608 and 686 category (see `category`), 70X persons and 71X
// organisations as authors (see `authors`).
export class UnimarcRecord {
    private constructor(private readonly fields: Fields) {}

    static all(xml: string): UnimarcRecord[] {
        return xml
            .split(/<(?:\w+:)?record>/)
            .slice(1)
            .filter((record) => /<(?:\w+:)?datafield/.test(record))
            .map((record) => new UnimarcRecord(UnimarcRecord.fields(record)));
    }

    static count(xml: string): number {
        return Number(xml.match(/<(?:\w+:)?numberOfRecords>(\d+)</)?.[1] ?? 0);
    }

    get isbns(): string[] {
        return (this.fields.get('010') ?? []).flatMap((entry) => entry.get('a') ?? []);
    }

    get subtitle(): string | null {
        return this.fields.get('200')?.[0]?.get('e')?.[0] ?? null;
    }

    get answer(): LookupAnswer {
        return UnimarcRecord.answer(this.fields);
    }

    private static answer(fields: Fields): LookupAnswer {
        const first = (tag: string, code: string) => fields.get(tag)?.[0]?.get(code)?.[0] ?? null;
        const language = first('101', 'a');
        const title = [first('200', 'a'), first('200', 'h'), first('200', 'i')]
            .filter(Boolean)
            .join('. ');
        const imprint = fields.has('214') ? '214' : '210';
        const year = (first(imprint, 'd') ?? '').match(/(\d{4})/)?.[1];
        // "1 vol. (257 p.)", "856 p.", "380 p", "1 vol. (non paginé [ca 176] p.)".
        const pages = (first('215', 'a') ?? '').match(/(\d+)\]?\s*p(?:\.|\b)/)?.[1];
        const summary = first('330', 'a');
        // The series field, or else a title with its volume number ("La Passe-miroir", 1).
        const titleVolume = (first('200', 'h') ?? '').match(/^\D*(\d+)\D*$/)?.[1];
        const seriesName = first('461', 't') ?? (titleVolume ? first('200', 'a') : null);
        const volume = fields.has('461')
            ? (first('461', 'v') ?? '').match(/(\d+)/)?.[1]
            : titleVolume;

        return LookupAnswer.of({
            title,
            authors: UnimarcRecord.authors(fields),
            publisher: first(imprint, 'c'),
            publicationDate: year ? { year: Number(year), month: null } : null,
            pageCount: pages ? Number(pages) : null,
            // A BnF summary describes this edition; it is taken as written in the edition's language.
            summary: summary ? { text: summary, language } : null,
            editionLanguage: language,
            series:
                seriesName && volume !== undefined
                    ? { name: seriesName, volume: Number(volume) }
                    : null,
            category: UnimarcRecord.category(fields),
        });
    }

    // A comic by its class in the Bibliographie nationale française (686 $a 805) or its form
    // "Bandes dessinées" (608); a manga when translated from Japanese, Korean or Chinese (101 $c:
    // manhwa and manhua count as manga). Anything else: no category, the form keeps its own.
    private static category(fields: Fields): BookCategory | null {
        const values = (tag: string, code: string) =>
            (fields.get(tag) ?? []).flatMap((entry) => entry.get(code) ?? []);
        const comic =
            values('686', 'a').includes('805') ||
            values('608', 'a').some((form) => /^bandes dessinées$/i.test(form));

        if (!comic) {
            return null;
        }

        return values('101', 'c').some((code) => UnimarcRecord.mangaLanguages.includes(code))
            ? 'manga'
            : 'comics';
    }

    // ISO 639-2 codes of the original languages that make a comic a manga.
    private static readonly mangaLanguages = ['jpn', 'kor', 'chi', 'zho'];

    // Main and alternative responsibilities (700/701 persons, 710/711 organisations) are authors;
    // secondary ones (702/712) only as author, illustrator or scenarist, by role code or, in some
    // newer records, by role text. Translators, preface writers and the like are left out.
    // "Fujisawa" + "Tooru" → "Tooru Fujisawa"; life dates and roles are separate subfields.
    private static authors(fields: Fields): string[] {
        const people = (tags: string[]) => tags.flatMap((tag) => fields.get(tag) ?? []);
        const person = (entry: Subfields) =>
            [entry.get('b')?.[0], entry.get('a')?.[0]].filter(Boolean).join(' ');
        const organisation = (entry: Subfields) =>
            [entry.get('a')?.[0], entry.get('b')?.[0]].filter(Boolean).join('. ');

        return [
            ...people(['700', '701']).map(person),
            ...people(['702']).filter(UnimarcRecord.authorRole).map(person),
            ...people(['710', '711']).map(organisation),
            ...people(['712']).filter(UnimarcRecord.authorRole).map(organisation),
        ];
    }

    private static authorRole(entry: Subfields): boolean {
        const codes = entry.get('4') ?? [];
        const roles = (entry.get('c') ?? []).join(' ');

        return (
            codes.some((code) => UnimarcRecord.authorCodes.includes(code)) ||
            /auteur du texte|^auteur$|illustrat|dessinat|scénari/i.test(roles.trim())
        );
    }

    // UNIMARC relator codes: 070 author, 440 illustrator, 690 scenarist.
    private static readonly authorCodes = ['070', '440', '690'];

    private static fields(record: string): Fields {
        const fields: Fields = new Map();

        for (const field of record.matchAll(
            /<(?:\w+:)?datafield tag="(\d{3})"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/g,
        )) {
            const tag = Required.at(field, 1, 'a datafield has a tag');
            const body = Required.at(field, 2, 'a datafield has a body');
            const subfields: Subfields = new Map();

            for (const subfield of body.matchAll(
                /<(?:\w+:)?subfield code="(.)">([\s\S]*?)<\/(?:\w+:)?subfield>/g,
            )) {
                const code = Required.at(subfield, 1, 'a subfield has a code');
                const value = Required.at(subfield, 2, 'a subfield has a value');

                subfields.set(code, [...(subfields.get(code) ?? []), UnimarcRecord.text(value)]);
            }

            fields.set(tag, [...(fields.get(tag) ?? []), subfields]);
        }

        return fields;
    }

    // XML entities decoded; the catalogue's non-sorting markers around articles removed.
    private static text(value: string): string {
        return value
            .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
            .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
                String.fromCodePoint(parseInt(code, 16)),
            )
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/[\u0088\u0089\u0098\u009c]/g, '')
            .trim();
    }
}
