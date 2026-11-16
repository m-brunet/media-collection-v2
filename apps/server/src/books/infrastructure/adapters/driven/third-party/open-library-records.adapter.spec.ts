import { describe, expect, it } from 'vitest';
import { SourceProbe } from '../../../../application/testing/book-doubles.test-support.js';
import { OpenLibraryRecords } from './open-library-records.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

function library(...bodies: (string | Error)[]) {
    const requests: string[] = [];
    const http = new SourceHttp(SourceProbe.queue(), async (url) => {
        requests.push(url);
        const body = bodies[Math.min(requests.length, bodies.length) - 1]!;

        if (body instanceof Error) {
            throw body;
        }

        return new Response(body, { status: 200 });
    });

    return { requests, records: new OpenLibraryRecords(http) };
}

const piranesi = JSON.stringify({ 'ISBN:9781635575637': { title: 'Piranesi' } });
const two = JSON.stringify({
    'ISBN:9782253164692': { title: "D'un monde à l'autre" },
    'ISBN:9781635575637': { title: 'Piranesi' },
});

describe('OpenLibraryRecords', () => {
    it('gives the record of the ISBN', async () => {
        const { records } = library(piranesi);

        const reply = await records.records(['9781635575637'], SourceProbe.turn);

        expect(reply).toEqual({
            kind: 'found',
            value: new Map([['9781635575637', { title: 'Piranesi' }]]),
        });
    });

    it('asks for the data of that ISBN only', async () => {
        const { requests, records } = library(piranesi);

        await records.records(['9781635575637'], SourceProbe.turn);

        const url = new URL(requests[0]!);

        expect(url.searchParams.get('bibkeys')).toBe('ISBN:9781635575637');
        expect(url.searchParams.get('jscmd')).toBe('data');
    });

    it('asks for several ISBNs in one request', async () => {
        const { requests, records } = library(two);

        await records.records(['9781635575637', '9782253164692'], SourceProbe.turn);

        expect(requests).toHaveLength(1);
        expect(new URL(requests[0]!).searchParams.get('bibkeys')).toBe(
            'ISBN:9781635575637,ISBN:9782253164692',
        );
    });

    it('gives each ISBN its own record, whatever the order of the answer', async () => {
        const { records } = library(two);

        const reply = await records.records(['9781635575637', '9782253164692'], SourceProbe.turn);

        expect(reply).toEqual({
            kind: 'found',
            value: new Map([
                ['9781635575637', { title: 'Piranesi' }],
                ['9782253164692', { title: "D'un monde à l'autre" }],
            ]),
        });
    });

    it('leaves out an ISBN of the batch that Open Library does not know', async () => {
        const { records } = library(piranesi);

        const reply = await records.records(['9781635575637', '9782253164692'], SourceProbe.turn);

        expect(reply).toEqual({
            kind: 'found',
            value: new Map([['9781635575637', { title: 'Piranesi' }]]),
        });
    });

    it('finds nothing for an ISBN Open Library does not know', async () => {
        const { records } = library('{}');

        const reply = await records.records(['9781635575637'], SourceProbe.turn);

        expect(reply).toEqual({ kind: 'found', value: new Map() });
    });

    it('answers the information and the cover lookups with one request', async () => {
        const { requests, records } = library(piranesi);

        await Promise.all([
            records.records(['9781635575637'], SourceProbe.turn),
            records.records(['9781635575637'], SourceProbe.turn),
        ]);

        expect(requests).toHaveLength(1);
    });

    it('asks again once the request has answered', async () => {
        const { requests, records } = library(piranesi);

        await records.records(['9781635575637'], SourceProbe.turn);

        await records.records(['9781635575637'], SourceProbe.turn);

        expect(requests).toHaveLength(2);
    });

    it('asks again after a failed request', async () => {
        const { requests, records } = library(new Error('unreachable'), piranesi);

        await records.records(['9781635575637'], SourceProbe.turn).catch(() => undefined);

        const reply = await records.records(['9781635575637'], SourceProbe.turn);

        expect(reply.kind).toBe('found');
        expect(requests).toHaveLength(2);
    });
});
