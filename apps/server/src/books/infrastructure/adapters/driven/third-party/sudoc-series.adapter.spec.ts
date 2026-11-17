import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SourceProbe } from '../../../../application/testing/book-doubles.test-support.js';
import { SeriesVolumes } from '../../../../domain/services/series-volumes.service.js';
import { SourceHttp } from './source-http.adapter.js';
import { SudocSeries } from './sudoc-series.adapter.js';

function recorded(name: string): string {
    return readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
}

function catalogue(body: string, status = 200, headers: Record<string, string> = {}) {
    const requests: URL[] = [];
    const http = new SourceHttp(SourceProbe.queue(), async (url) => {
        requests.push(new URL(url));

        return new Response(body, { status, headers });
    });

    return { requests, source: new SudocSeries(http) };
}

const nothingFound =
    '<srw:searchRetrieveResponse><srw:numberOfRecords>0</srw:numberOfRecords></srw:searchRetrieveResponse>';

describe('SudocSeries', () => {
    it('reads the edition of an owned volume from its ISBN, with its series and publisher', async () => {
        const { source } = catalogue(recorded('sudoc-series-edition-kenshin-3.xml'));

        const editions = await source.editions(['9782723427777'], SourceProbe.turn);

        expect(editions).toMatchObject({
            kind: 'found',
            value: [
                {
                    isbns: ['2-7234-2777-3'],
                    answer: {
                        title: "La raison d'agir",
                        series: { name: 'Kenshin le vagabond', volume: 3 },
                        publisher: 'Glénat',
                    },
                },
            ],
        });
    });

    it('asks for every owned ISBN in one request', async () => {
        const { source, requests } = catalogue(recorded('sudoc-series-edition-kenshin-3.xml'));

        await source.editions(['9782723427777', '9782723427784'], SourceProbe.turn);

        expect(requests.map((request) => request.searchParams.get('query'))).toEqual([
            'isb=9782723427777 or isb=9782723427784',
        ]);
    });

    it('asks nothing without an ISBN', async () => {
        const { source, requests } = catalogue(nothingFound);

        const editions = await source.editions([], SourceProbe.turn);

        expect(editions).toEqual({ kind: 'none' });
        expect(requests).toHaveLength(0);
    });

    it('finds no edition for ISBNs the catalogue does not know', async () => {
        const { source } = catalogue(nothingFound);

        const editions = await source.editions(['9782723427777'], SourceProbe.turn);

        expect(editions).toEqual({ kind: 'none' });
    });

    it('searches a series by the words of its title and its publisher', async () => {
        const { source, requests } = catalogue(recorded('sudoc-series-darwins-game.xml'));

        await source.volumes("Darwin's game", 'Ki-oon', 1, SourceProbe.turn);

        expect(Object.fromEntries(requests[0]!.searchParams)).toEqual({
            operation: 'searchRetrieve',
            version: '1.1',
            recordSchema: 'unimarc',
            query: "mti=Darwin's game and edi=Ki-oon",
            maximumRecords: '50',
            startRecord: '1',
        });
    });

    it('asks without the accents, quotes and punctuation of the names', async () => {
        const { source, requests } = catalogue(nothingFound);

        await source.volumes('Blame! "Édition" (deluxe) - = 2', 'Glénat', 1, SourceProbe.turn);

        expect(requests[0]!.searchParams.get('query')).toBe(
            'mti=Blame Edition deluxe 2 and edi=Glenat',
        );
    });

    it('leaves the words the query language reserves out of the names', async () => {
        const { source, requests } = catalogue(nothingFound);

        await source.volumes('Love and war or not', 'Kana', 1, SourceProbe.turn);

        expect(requests[0]!.searchParams.get('query')).toBe('mti=Love war and edi=Kana');
    });

    it('asks nothing for a series name without a word', async () => {
        const { source, requests } = catalogue(nothingFound);

        const page = await source.volumes('!?', 'Kana', 1, SourceProbe.turn);

        expect(page).toEqual({ kind: 'none' });
        expect(requests).toHaveLength(0);
    });

    it('tells the next page of a series longer than 50 records', async () => {
        const { source } = catalogue(recorded('sudoc-series-darwins-game.xml'));

        const page = await source.volumes("Darwin's game", 'Ki-oon', 1, SourceProbe.turn);

        expect(page.kind === 'found' && [page.value.records.length, page.value.next]).toEqual([
            50, 51,
        ]);
    });

    it('asks a following page from its first record, the last one having no next', async () => {
        const { source, requests } = catalogue(recorded('sudoc-series-darwins-game.xml'));

        const page = await source.volumes("Darwin's game", 'Ki-oon', 51, SourceProbe.turn);

        expect(requests[0]!.searchParams.get('startRecord')).toBe('51');
        expect(page.kind === 'found' && page.value.next).toBeNull();
    });

    it('reads volume numbers written in the series link and in the title', async () => {
        const { source } = catalogue(recorded('sudoc-series-darwins-game.xml'));

        const page = await source.volumes("Darwin's game", 'Ki-oon', 1, SourceProbe.turn);

        expect(page.kind === 'found' && page.value.records).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    isbns: ['979-10-327-1931-2'],
                    answer: expect.objectContaining({
                        series: { name: "Darwin's game", volume: 30 },
                    }),
                }),
                expect.objectContaining({
                    isbns: ['978-2-35592-800-0'],
                    answer: expect.objectContaining({
                        series: { name: "Darwin's game", volume: 4 },
                    }),
                }),
            ]),
        );
    });

    it('leaves out another series sharing words with the one searched', async () => {
        const { source } = catalogue(recorded('sudoc-series-darwins-game.xml'));
        const page = await source.volumes("Darwin's game", 'Ki-oon', 1, SourceProbe.turn);
        const records = page.kind === 'found' ? page.value.records : [];
        const anchor = SeriesVolumes.anchorOf(records, [{ isbn13: '9782355928000', volume: 4 }]);

        const volumes = SeriesVolumes.of(anchor!, records);

        expect(volumes.editions(5).map((edition) => edition.answer.title)).toEqual([
            "Darwin's game. 5",
        ]);
    });

    it('finds nothing for a series the catalogue does not know', async () => {
        const { source } = catalogue(nothingFound);

        const page = await source.volumes('Nothing', 'Nobody', 1, SourceProbe.turn);

        expect(page).toEqual({ kind: 'none' });
    });

    it('reports a catalogue asking to wait', async () => {
        const { source } = catalogue('', 429, { 'Retry-After': '120' });

        const page = await source.volumes('Claymore', 'Glénat', 1, SourceProbe.turn);

        expect(page).toMatchObject({ kind: 'limited', retryAt: expect.any(Date) });
    });
});
