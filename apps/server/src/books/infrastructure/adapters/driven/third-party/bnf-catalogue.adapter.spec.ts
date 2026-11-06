import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BnfCatalogue } from './bnf-catalogue.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

function recorded(name: string): string {
    return readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
}

// A catalogue answering every request with one recorded response, noting the requested URLs.
function catalogue(body: string, status = 200, headers: Record<string, string> = {}) {
    const requests: string[] = [];
    const http = new SourceHttp(async (url) => {
        requests.push(url);

        return new Response(body, { status, headers });
    });

    return { requests, source: new BnfCatalogue(http) };
}

// A minimal UNIMARC record holding the given data fields, as the catalogue sends them.
function record(...fields: string[]): string {
    return (
        '<srw:searchRetrieveResponse><srw:numberOfRecords>1</srw:numberOfRecords><srw:records>' +
        '<srw:record><srw:recordData><mxc:record format="Unimarc" type="Bibliographic">' +
        field('200', { a: 'Un titre' }) +
        fields.join('') +
        '</mxc:record></srw:recordData></srw:record></srw:records></srw:searchRetrieveResponse>'
    );
}

function field(tag: string, subfields: Record<string, string>): string {
    return (
        `<mxc:datafield tag="${tag}" ind1=" " ind2=" ">` +
        Object.entries(subfields)
            .map(([code, value]) => `<mxc:subfield code="${code}">${value}</mxc:subfield>`)
            .join('') +
        '</mxc:datafield>'
    );
}

describe('BnfCatalogue', () => {
    it('reads a manga volume with its series, without its translator', async () => {
        const { source } = catalogue(recorded('bnf-rose-hip-rose-1.xml'));

        const reply = await source.find('9782845998179');

        expect(reply).toMatchObject({
            kind: 'found',
            value: {
                title: 'Rose hip Rose. 1',
                authors: ['Tooru Fujisawa'],
                publisher: 'Pika éd.',
                publicationDate: { year: 2008, month: null },
                pageCount: 176,
                editionLanguage: 'fre',
                series: { name: 'Rose hip Rose', volume: 1 },
            },
        });
        expect(reply.kind === 'found' && reply.value.summary).toMatchObject({
            text: expect.stringContaining('Kasumi Asakura'),
            language: 'fre',
        });
    });

    it("keeps a volume's own title and its series apart", async () => {
        const { source } = catalogue(recorded('bnf-claymore-15.xml'));

        const reply = await source.find('9782723471930');

        expect(reply).toMatchObject({
            kind: 'found',
            value: {
                title: 'Les sources du conflit',
                authors: ['Norihiro Yagi'],
                publisher: 'Glénat',
                pageCount: 196,
                series: { name: 'Claymore', volume: 15 },
            },
        });
    });

    it('reads a novel and its page count', async () => {
        const { source } = catalogue(recorded('bnf-ewilan-1.xml'));

        const reply = await source.find('9782253164692');

        expect(reply).toMatchObject({
            kind: 'found',
            value: {
                title: "D'un monde à l'autre",
                authors: ['Pierre Bottero'],
                publisher: 'Librairie générale française',
                publicationDate: { year: 2012, month: null },
                pageCount: 257,
            },
        });
    });

    it('reads an author given only as a secondary name with a written role', async () => {
        const { source } = catalogue(recorded('bnf-passe-miroir-1.xml'));

        const reply = await source.find('9782075215466');

        expect(reply).toMatchObject({
            kind: 'found',
            value: {
                title: "La Passe-miroir. 1. Les Fiancés de l'hiver",
                authors: ['Christelle Dabos'],
                publisher: 'Gallimard jeunesse',
                publicationDate: { year: 2024, month: null },
                pageCount: 608,
                series: { name: 'La Passe-miroir', volume: 1 },
            },
        });
    });

    it('reads an organisation as author', async () => {
        const { source } = catalogue(record(field('710', { a: 'Clamp', 4: '070' })));

        const reply = await source.find('9782845990000');

        expect(reply).toMatchObject({ value: { authors: ['Clamp'] } });
    });

    it('keeps illustrators and leaves translators out', async () => {
        const { source } = catalogue(
            record(
                field('700', { a: 'Ohba', b: 'Tsugumi', 4: '070' }),
                field('702', { a: 'Obata', b: 'Takeshi', 4: '440' }),
                field('702', { a: 'Moulin', b: 'Fédoua', 4: '730' }),
                field('702', { a: 'Martin', b: 'Anne', c: 'Traducteur' }),
            ),
        );

        const reply = await source.find('9782505000000');

        expect(reply).toMatchObject({ value: { authors: ['Tsugumi Ohba', 'Takeshi Obata'] } });
    });

    it('finds nothing for an ISBN the catalogue does not know', async () => {
        const { source } = catalogue(recorded('bnf-none.xml'));

        const reply = await source.find('9780000000002');

        expect(reply).toEqual({ kind: 'none' });
    });

    it('asks for the UNIMARC record of the ISBN', async () => {
        const { requests, source } = catalogue(recorded('bnf-none.xml'));

        await source.find('9782253164692');

        const url = new URL(requests[0]!);

        expect(url.origin + url.pathname).toBe(BnfCatalogue.address);
        expect(url.searchParams.get('query')).toBe('bib.isbn all "9782253164692"');
        expect(url.searchParams.get('recordSchema')).toBe('unimarcxchange');
    });

    it('reports a catalogue asking to wait', async () => {
        const { source } = catalogue('', 429, { 'Retry-After': '120' });

        const reply = await source.find('9782253164692');

        expect(reply).toMatchObject({ kind: 'limited', retryAt: expect.any(Date) });
    });
});
