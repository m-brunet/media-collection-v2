import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BnfSeries } from './bnf-series.adapter.js';
import { BnfSru } from './bnf-sru.adapter.js';
import { SourceHttp } from './source-http.adapter.js';
import { SeriesVolumes } from '../../../../domain/services/series-volumes.service.js';

function recorded(name: string): string {
    return readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
}

function catalogue(body: string, status = 200, headers: Record<string, string> = {}) {
    const requests: URL[] = [];
    const http = new SourceHttp(async (url) => {
        requests.push(new URL(url));

        return new Response(body, { status, headers });
    });

    return { requests, source: new BnfSeries(http) };
}

function reply(total: number): string {
    return (
        `<srw:searchRetrieveResponse><srw:numberOfRecords>${total}</srw:numberOfRecords>` +
        '<srw:records><srw:record><srw:recordData><mxc:record format="Unimarc">' +
        '<mxc:datafield tag="010" ind1=" " ind2=" "><mxc:subfield code="a">978-2-7234-8852-5</mxc:subfield></mxc:datafield>' +
        '<mxc:datafield tag="200" ind1=" " ind2=" "><mxc:subfield code="a">Romance dawn</mxc:subfield></mxc:datafield>' +
        '</mxc:record></srw:recordData></srw:record></srw:records></srw:searchRetrieveResponse>'
    );
}

describe('BnfSeries', () => {
    it("reads a series' records with their ISBN, subtitle and volume", async () => {
        const { source } = catalogue(recorded('bnf-series-one-piece.xml'));

        const page = await source.volumes('One piece', 'Glénat', 1);

        expect(page.kind === 'found' && page.value.records).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    isbns: ['978-2-7234-8990-4'],
                    subtitle: null,
                    answer: expect.objectContaining({
                        title: 'Piété filiale',
                        series: { name: 'One piece', volume: 3 },
                        publicationDate: { year: 2013, month: null },
                    }),
                }),
                expect.objectContaining({
                    isbns: ['978-2-344-05219-8'],
                    answer: expect.objectContaining({
                        series: { name: 'One piece', volume: 106 },
                    }),
                }),
                expect.objectContaining({
                    isbns: ['2-7234-5418-5'],
                    subtitle: 'color walk',
                    answer: expect.objectContaining({ series: { name: 'One piece', volume: 1 } }),
                }),
            ]),
        );
    });

    it('reads the volume of a title written "T. 5"', async () => {
        const { source } = catalogue(recorded('bnf-series-gunnm.xml'));

        const page = await source.volumes('Gunnm', 'Glénat', 1);

        expect(page.kind === 'found' && page.value.records).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    isbns: ['2-7234-1974-6'],
                    answer: expect.objectContaining({ series: { name: 'Gunnm.', volume: 5 } }),
                }),
            ]),
        );
    });

    it('searches the series by its name and publisher, a thousand records at a time', async () => {
        const { requests, source } = catalogue(reply(1));

        await source.volumes('One "piece"', 'Glénat', 1);

        expect(requests[0]!.origin + requests[0]!.pathname).toBe(BnfSru.address);
        expect(requests[0]!.searchParams.get('query')).toBe(
            'bib.title all "One  piece" and bib.publisher all "Glénat"',
        );
        expect(requests[0]!.searchParams.get('maximumRecords')).toBe('1000');
        expect(requests[0]!.searchParams.get('startRecord')).toBeNull();
    });

    it('gives the start of the next page while records remain', async () => {
        const { requests, source } = catalogue(reply(1500));

        const first = await source.volumes('One piece', 'Glénat', 1);
        const second = await source.volumes('One piece', 'Glénat', 1001);

        expect(first).toMatchObject({ kind: 'found', value: { next: 1001 } });
        expect(second).toMatchObject({ kind: 'found', value: { next: null } });
        expect(requests[1]!.searchParams.get('startRecord')).toBe('1001');
    });

    it('asks for several editions in a single request', async () => {
        const { requests, source } = catalogue(reply(1));

        const editions = await source.editions(['9782723488525', '9782344052181']);

        expect(editions).toMatchObject({
            kind: 'found',
            value: [{ isbns: ['978-2-7234-8852-5'] }],
        });
        expect(requests).toHaveLength(1);
        expect(requests[0]!.searchParams.get('query')).toBe(
            'bib.isbn all "9782723488525" or bib.isbn all "9782344052181"',
        );
    });

    it('asks nothing for no edition', async () => {
        const { requests, source } = catalogue(reply(1));

        const editions = await source.editions([]);

        expect(editions).toEqual({ kind: 'none' });
        expect(requests).toHaveLength(0);
    });

    it('finds nothing for a series the catalogue does not know', async () => {
        const { source } = catalogue(recorded('bnf-none.xml'));

        const page = await source.volumes('Nothing', 'Nobody', 1);

        expect(page).toEqual({ kind: 'none' });
    });

    it('reports a catalogue asking to wait', async () => {
        const { source } = catalogue('', 429, { 'Retry-After': '120' });

        const page = await source.volumes('One piece', 'Glénat', 1);

        expect(page).toMatchObject({ kind: 'limited', retryAt: expect.any(Date) });
    });

    it("separates Gunnm's editions: the anchor's first, Mars chronicle last, 1995's \"Gunnm.\" apart", async () => {
        const { source } = catalogue(recorded('bnf-series-gunnm.xml'));
        const page = await source.volumes('Gunnm', 'Glénat', 1);
        const records = page.kind === 'found' ? page.value.records : [];
        const anchor = SeriesVolumes.anchorOf(records, [{ isbn13: '9782723434799', volume: 5 }]);

        const volumes = SeriesVolumes.of(anchor!, records);

        expect(volumes.editions(1).map((edition) => edition.isbn13)).toEqual([
            '9782723432931',
            '9782344017548',
            '9782344017517',
        ]);
        expect(volumes.editions(3)[0]?.isbn13).toBe('9782723434775');
    });

    it("finds One Piece's volumes catalogued under their own title or as an original edition", async () => {
        const { source } = catalogue(recorded('bnf-series-one-piece.xml'));
        const page = await source.volumes('One piece', 'Glénat', 1);
        const records = page.kind === 'found' ? page.value.records : [];
        const anchor = SeriesVolumes.anchorOf(records, [{ isbn13: '9782344052198', volume: 106 }]);

        const volumes = SeriesVolumes.of(anchor!, records);

        expect(volumes.editions(10)[0]?.answer.title).toBe("OK, let's stand up !");
        expect(volumes.editions(3).map((edition) => edition.answer.title)).toEqual([
            'Piété filiale',
            'Piété filiale',
            'One piece. 3',
        ]);
        expect(volumes.editions(113)[0]?.isbn13).toBe('9782344071120');
        expect(volumes.editions(2).map((edition) => edition.isbn13)).not.toContain('9782344020425');
    });
});
