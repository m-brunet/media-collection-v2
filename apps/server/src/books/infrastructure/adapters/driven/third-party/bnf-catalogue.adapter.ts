import type {
    LookupSource,
    SourceReply,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import { LookupAnswer } from '../../../../domain/value-objects/lookup-answer.value-object.js';
import type { SourceHttp } from './source-http.adapter.js';

type Subfields = Map<string, string[]>;
type Fields = Map<string, Subfields[]>;

// The BnF general catalogue (SRU, UNIMARC records), queried by ISBN. Licence Ouverte: free
// reuse, source credited. Fields used: 101 language, 200 title, 210/214 publisher and date,
// 215 extent, 330 summary, 461 series and volume, 700/701 authors (702 secondary
// responsibilities such as translators are left out).
export class BnfCatalogue implements LookupSource<LookupAnswer> {
    static readonly address = 'https://catalogue.bnf.fr/api/SRU';

    readonly name = 'bnf';
    // The BnF publishes no figure for this service; a household's lookups stay far below this.
    readonly limit = { requests: 30, seconds: 60 };

    constructor(
        private readonly http: SourceHttp,
        private readonly address = BnfCatalogue.address,
    ) {}

    async find(isbn13: string): Promise<SourceReply<LookupAnswer>> {
        const query = new URLSearchParams({
            version: '1.2',
            operation: 'searchRetrieve',
            query: `bib.isbn all "${isbn13}"`,
            recordSchema: 'unimarcxchange',
            maximumRecords: '1',
        });
        const reply = await this.http.get(this.address + '?' + query.toString(), 'application/xml');

        if (reply.kind === 'limited') {
            return reply;
        }

        const fields = BnfCatalogue.firstRecord(await reply.response.text());

        if (!fields) {
            return { kind: 'none' };
        }

        const answer = BnfCatalogue.answer(fields);

        return answer.empty ? { kind: 'none' } : { kind: 'found', value: answer };
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
        const seriesName = first('461', 't');
        const volume = (first('461', 'v') ?? '').match(/(\d+)/)?.[1];

        return LookupAnswer.of({
            title,
            authors: BnfCatalogue.authors(fields),
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
        });
    }

    // "Fujisawa" + "Tooru" → "Tooru Fujisawa"; life dates and roles are separate subfields.
    private static authors(fields: Fields): string[] {
        return [...(fields.get('700') ?? []), ...(fields.get('701') ?? [])].map((person) =>
            [person.get('b')?.[0], person.get('a')?.[0]].filter(Boolean).join(' '),
        );
    }

    // The data fields of the first record: tag → occurrences → subfield code → values.
    private static firstRecord(xml: string): Fields | null {
        const record = xml.split(/<(?:\w+:)?record>/)[1];

        if (!record || !/<(?:\w+:)?datafield/.test(record)) {
            return null;
        }

        const fields: Fields = new Map();

        for (const [, tag, body] of record.matchAll(
            /<(?:\w+:)?datafield tag="(\d{3})"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/g,
        )) {
            const subfields: Subfields = new Map();

            for (const [, code, value] of body!.matchAll(
                /<(?:\w+:)?subfield code="(.)">([\s\S]*?)<\/(?:\w+:)?subfield>/g,
            )) {
                subfields.set(code!, [...(subfields.get(code!) ?? []), BnfCatalogue.text(value!)]);
            }

            fields.set(tag!, [...(fields.get(tag!) ?? []), subfields]);
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
