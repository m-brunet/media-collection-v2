import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SourceProbe } from '../../../../application/testing/book-doubles.test-support.js';
import { SourceHttp } from './source-http.adapter.js';
import { SudocCatalogue } from './sudoc-catalogue.adapter.js';

function recorded(name: string): string {
    return readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
}

type Answer = { body: string; status?: number; headers?: Record<string, string> };

const noRecord: Answer = { body: recorded('sudoc-isbn2ppn-none.json'), status: 404 };
const nothingFound: Answer = {
    body: '<srw:searchRetrieveResponse><srw:numberOfRecords>0</srw:numberOfRecords></srw:searchRetrieveResponse>',
};

function ppnOf(ppn: string | string[], key: 'result' | 'resultNoHolding' = 'result'): Answer {
    const value = Array.isArray(ppn) ? ppn.map((one) => ({ ppn: one })) : { ppn };

    return { body: JSON.stringify({ sudoc: { query: { [key]: value } } }) };
}

function sudoc(
    answers: {
        search?: Answer | Answer[];
        ppns?: Record<string, Answer>;
        records?: Record<string, Answer>;
    } = {},
) {
    const requests: string[] = [];
    const pages = [answers.search ?? nothingFound].flat();
    const http = new SourceHttp(SourceProbe.queue(), async (address) => {
        const url = new URL(address);
        const last = url.pathname.split('/').at(-1) ?? '';
        let answer: Answer;

        requests.push(address);

        if (url.pathname.startsWith('/cbs/sru')) {
            const start = Number(url.searchParams.get('startRecord'));

            answer = pages[Math.floor(start / SudocCatalogue.pageSize)] ?? nothingFound;
        } else if (url.pathname.includes('/isbn2ppn/')) {
            answer = answers.ppns?.[last] ?? noRecord;
        } else {
            answer = answers.records?.[last.replace('.xml', '')] ?? { body: '', status: 404 };
        }

        return new Response(answer.body, { status: answer.status ?? 200, headers: answer.headers });
    });
    const paths = () => requests.map((address) => new URL(address).pathname);

    return { requests, paths, source: new SudocCatalogue(http) };
}

const thirteen = [
    '9782070614554',
    '9782253174011',
    '9782723419000',
    '9782723471930',
    '9791032719312',
    '9782800100173',
    '9782800170138',
    '9782808514651',
    '9782253157632',
    '9782723456364',
    '9791032703205',
    '9782811209124',
    '9782811217105',
];
const batch: Answer = { body: recorded('sudoc-sru-ten-of-thirteen.xml') };
const bitterblue = '9782253174011';
const gunnm = '9782723419000';
const claymore1 = '9782723456364';

async function found(source: SudocCatalogue, isbn13s: readonly string[]) {
    const reply = await source.find(isbn13s, SourceProbe.turn);

    return reply.kind === 'found' || reply.kind === 'partial' ? reply.value : new Map();
}

describe('SudocCatalogue', () => {
    it('asks for several ISBNs in one search', async () => {
        const { source, requests } = sudoc({ search: batch });

        await source.find([claymore1, gunnm], SourceProbe.turn);

        const url = new URL(requests[0]!);

        expect(url.origin + url.pathname).toBe('https://www.sudoc.abes.fr/cbs/sru/');
        expect([...url.searchParams]).toEqual([
            ['operation', 'searchRetrieve'],
            ['version', '1.1'],
            ['recordSchema', 'unimarc'],
            ['query', 'isb=9782723456364 or isb=9782723419000'],
            ['maximumRecords', '50'],
            ['startRecord', '1'],
        ]);
        expect(requests).toHaveLength(1);
    });

    it('gives each ISBN its own record, whatever the order of the answer', async () => {
        const { source } = sudoc({ search: batch });

        const answers = await found(source, thirteen);

        expect(answers.get('9782723471930')?.title).toBe('Claymore. 15. les sources du conflit');
        expect(answers.get('9782811217105')?.title).toBe('La guilde des magiciens');
        expect(answers.size).toBe(10);
    });

    it('matches a record that only carries the ISBN-10', async () => {
        const { source } = sudoc({ search: batch });

        const answers = await found(source, [gunnm]);

        expect(answers.get(gunnm)?.title).toBe('Gunnm. Tome 1');
    });

    it('asks once for an ISBN requested twice', async () => {
        const { source, requests } = sudoc({ search: batch });

        await source.find([claymore1, claymore1], SourceProbe.turn);

        expect(new URL(requests[0]!).searchParams.get('query')).toBe('isb=9782723456364');
    });

    it('asks nothing more for the ISBNs the search matched', async () => {
        const { source, paths } = sudoc({ search: batch });

        await source.find([claymore1, gunnm], SourceProbe.turn);

        expect(paths()).toEqual(['/cbs/sru/']);
    });

    it('finds a record no library holds through its record number', async () => {
        const { source, paths } = sudoc({
            ppns: { [bitterblue]: { body: recorded('sudoc-isbn2ppn-no-holding.json') } },
            records: { '171390849': { body: recorded('sudoc-record-bitterblue.xml') } },
        });

        const reply = await SourceProbe.one(source, bitterblue);

        expect(reply.kind === 'found' && reply.value.title).toBe('Bitterblue');
        expect(paths()).toEqual([
            '/cbs/sru/',
            '/services/isbn2ppn/9782253174011',
            '/171390849.xml',
        ]);
    });

    it('finds a held record the search left out the same way', async () => {
        const { source } = sudoc({
            ppns: { [gunnm]: ppnOf('049846248') },
            records: { '049846248': { body: recorded('sudoc-record-gunnm-1.xml') } },
        });

        const reply = await SourceProbe.one(source, gunnm);

        expect(reply.kind === 'found' && reply.value.title).toBe('Gunnm. Tome 1');
    });

    it('finds nothing for an ISBN absent from both routes, without a record download', async () => {
        const { source, paths } = sudoc();

        const reply = await SourceProbe.one(source, '9782253917502');

        expect(reply).toEqual({ kind: 'none' });
        expect(paths()).toEqual(['/cbs/sru/', '/services/isbn2ppn/9782253917502']);
    });

    it('asks one by one only for the ISBNs the search did not match', async () => {
        const { source, paths } = sudoc({ search: batch });

        await source.find([claymore1, bitterblue, gunnm], SourceProbe.turn);

        expect(paths()).toEqual(['/cbs/sru/', '/services/isbn2ppn/9782253174011']);
    });

    it('downloads a record shared by two ISBNs once', async () => {
        const { source, paths } = sudoc({
            ppns: { [bitterblue]: ppnOf('171390849'), '9782253917502': ppnOf('171390849') },
            records: { '171390849': { body: recorded('sudoc-record-bitterblue.xml') } },
        });

        const answers = await found(source, [bitterblue, '9782253917502']);

        expect(answers.size).toBe(2);
        expect(paths().filter((path) => path.endsWith('.xml'))).toEqual(['/171390849.xml']);
    });

    it('reads at most two of the records an ISBN has', async () => {
        const { source, paths } = sudoc({
            ppns: { [bitterblue]: ppnOf(['111111111', '222222222', '171390849']) },
            records: { '171390849': { body: recorded('sudoc-record-bitterblue.xml') } },
        });

        const reply = await SourceProbe.one(source, bitterblue);

        expect(reply).toEqual({ kind: 'none' });
        expect(paths().filter((path) => path.endsWith('.xml'))).toEqual([
            '/111111111.xml',
            '/222222222.xml',
        ]);
    });

    it('reads the following page when the first one is not the whole answer', async () => {
        const first = batch.body.replace('<srw:numberOfRecords>10<', '<srw:numberOfRecords>60<');
        const { source, requests } = sudoc({ search: [{ body: first }, batch] });

        await source.find([claymore1], SourceProbe.turn);

        expect(requests.map((address) => new URL(address).searchParams.get('startRecord'))).toEqual(
            ['1', '51'],
        );
    });

    it('stops after two pages', async () => {
        const endless = batch.body.replace('<srw:numberOfRecords>10<', '<srw:numberOfRecords>900<');
        const { source, paths } = sudoc({ search: [{ body: endless }, { body: endless }] });

        await source.find([claymore1], SourceProbe.turn);

        expect(paths()).toEqual(['/cbs/sru/', '/cbs/sru/']);
    });

    it('reports a search asked to wait, and asks nothing one by one', async () => {
        const { source, paths } = sudoc({
            search: { body: '', status: 429, headers: { 'Retry-After': '120' } },
        });

        const reply = await source.find([claymore1, bitterblue], SourceProbe.turn);

        expect(reply.kind).toBe('limited');
        expect(paths()).toEqual(['/cbs/sru/']);
    });

    it('fails on a search error, and asks nothing one by one', async () => {
        const { source, paths } = sudoc({ search: { body: '', status: 500 } });

        const reply = source.find([claymore1, bitterblue], SourceProbe.turn);

        await expect(reply).rejects.toThrow();
        expect(paths()).toEqual(['/cbs/sru/']);
    });

    it('keeps the matched records when the one-by-one route is asked to wait', async () => {
        const { source } = sudoc({
            search: batch,
            ppns: { [bitterblue]: { body: '', status: 503 } },
        });

        const reply = await source.find([claymore1, bitterblue], SourceProbe.turn);

        expect(reply.kind === 'partial' && [...reply.value.keys()]).toEqual([claymore1]);
        expect(reply.kind === 'partial' && reply.unsettled.get(bitterblue)).toMatchObject({
            kind: 'limited',
        });
    });

    it('leaves the following ISBNs unanswered once one request is refused', async () => {
        const { source, paths } = sudoc({ ppns: { [bitterblue]: { body: '', status: 503 } } });

        const reply = await source.find([bitterblue, gunnm, claymore1], SourceProbe.turn);

        expect(reply.kind === 'partial' && [...reply.unsettled.keys()]).toEqual([
            bitterblue,
            gunnm,
            claymore1,
        ]);
        expect(paths()).toEqual(['/cbs/sru/', '/services/isbn2ppn/9782253174011']);
    });

    it('reports an ISBN whose one-by-one request failed as unanswered, not as unknown', async () => {
        const { source } = sudoc({ ppns: { [bitterblue]: { body: '', status: 500 } } });

        const reply = await source.find([bitterblue], SourceProbe.turn);

        expect(reply.kind === 'partial' && reply.unsettled.get(bitterblue)).toBe('failed');
    });

    it('leaves the translators out of the authors', async () => {
        const { source } = sudoc({ search: batch });

        const answers = await found(source, [claymore1]);

        expect(answers.get(claymore1)?.authors).toEqual(['Norihiro Yagi']);
    });

    it('leaves the letterer out of the authors', async () => {
        const { source } = sudoc({ search: batch });

        const answers = await found(source, [gunnm]);

        expect(answers.get(gunnm)?.authors).toEqual(['Yukito Kishiro']);
    });

    it('reads a page count written in full', async () => {
        const { source } = sudoc({ search: batch });

        const answers = await found(source, [gunnm]);

        expect(answers.get(gunnm)?.pageCount).toBe(218);
    });

    it('reads the publisher and the date, not the printer', async () => {
        const { source } = sudoc({ search: batch });

        const answers = await found(source, ['9791032703205']);

        expect(answers.get('9791032703205')).toMatchObject({
            publisher: 'Ki-oon',
            publicationDate: { year: 2018, month: null },
        });
    });

    it('reads the series, the volume and the summary', async () => {
        const { source } = sudoc({ search: batch });

        const answers = await found(source, ['9782800100173']);

        expect(answers.get('9782800100173')).toMatchObject({
            series: { name: 'Spirou et Fantasio', volume: 15 },
            summary: {
                text: 'Zorglub, un scientifique à la fois loufoque et dangereux, veut collaborer avec Champignac.',
            },
        });
    });
});
