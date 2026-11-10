import { describe, expect, it } from 'vitest';
import { OpenLibraryRecords } from './open-library-records.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

function library(...bodies: (string | Error)[]) {
    const requests: string[] = [];
    let now = new Date('2026-11-06T10:00:00Z');
    const http = new SourceHttp(async (url) => {
        requests.push(url);
        const body = bodies[Math.min(requests.length, bodies.length) - 1]!;

        if (body instanceof Error) {
            throw body;
        }

        return new Response(body, { status: 200 });
    });
    const records = new OpenLibraryRecords(http, OpenLibraryRecords.address, () => now);

    return {
        requests,
        records,
        advance: (seconds: number) => {
            now = new Date(now.getTime() + seconds * 1000);
        },
    };
}

const piranesi = JSON.stringify({ 'ISBN:9781635575637': { title: 'Piranesi' } });

describe('OpenLibraryRecords', () => {
    it('gives the record of the ISBN', async () => {
        const { records } = library(piranesi);

        const reply = await records.record('9781635575637');

        expect(reply).toEqual({ kind: 'found', value: { title: 'Piranesi' } });
    });

    it('asks for the data of that ISBN only', async () => {
        const { requests, records } = library(piranesi);

        await records.record('9781635575637');

        const url = new URL(requests[0]!);

        expect(url.searchParams.get('bibkeys')).toBe('ISBN:9781635575637');
        expect(url.searchParams.get('jscmd')).toBe('data');
    });

    it('finds nothing for an ISBN Open Library does not know', async () => {
        const { records } = library('{}');

        const reply = await records.record('9781635575637');

        expect(reply).toEqual({ kind: 'none' });
    });

    it('answers the information and the cover lookups with one request', async () => {
        const { requests, records } = library(piranesi);

        await Promise.all([records.record('9781635575637'), records.record('9781635575637')]);

        expect(requests).toHaveLength(1);
    });

    it('asks again after a minute', async () => {
        const { requests, records, advance } = library(piranesi);

        await records.record('9781635575637');
        advance(OpenLibraryRecords.reuseSeconds);

        await records.record('9781635575637');

        expect(requests).toHaveLength(2);
    });

    it('asks again after a failed request', async () => {
        const { requests, records } = library(new Error('unreachable'), piranesi);

        await records.record('9781635575637').catch(() => undefined);

        const reply = await records.record('9781635575637');

        expect(reply.kind).toBe('found');
        expect(requests).toHaveLength(2);
    });
});
