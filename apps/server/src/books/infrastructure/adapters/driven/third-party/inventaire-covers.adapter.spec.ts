import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SourceProbe } from '../../../../application/testing/book-doubles.test-support.js';
import { InventaireCovers } from './inventaire-covers.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

function recorded(name: string): string {
    return readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
}

function inventaire(body: string, status = 200, headers: Record<string, string> = {}) {
    const requests: string[] = [];
    const http = new SourceHttp(SourceProbe.queue(), async (url) => {
        requests.push(url);

        return new Response(body, { status, headers });
    });

    return { requests, source: new InventaireCovers(http) };
}

const claymore = 'https://inventaire.io/img/entities/637042f24123f713ca64b13732771b5febb67a43';

describe('InventaireCovers', () => {
    it('offers the picture of the edition, at its address on the Inventaire site', async () => {
        const { source } = inventaire(recorded('inventaire-claymore-15.json'));

        const reply = await SourceProbe.one(source, '9782723471930');

        expect(reply).toEqual({
            kind: 'found',
            value: [{ address: claymore, width: null, height: null, fingerprint: null }],
        });
    });

    it('asks for the edition of the ISBN, without its work or its series', async () => {
        const { source, requests } = inventaire(recorded('inventaire-claymore-15.json'));

        await SourceProbe.one(source, '9782723471930');

        const url = new URL(requests[0]!);

        expect(url.origin + url.pathname).toBe('https://inventaire.io/api/entities/by-uris');
        expect([...url.searchParams]).toEqual([['uris', 'isbn:9782723471930']]);
    });

    it('finds nothing for an ISBN Inventaire does not know', async () => {
        const { source } = inventaire(recorded('inventaire-none.json'));

        const reply = await SourceProbe.one(source, '9782808514651');

        expect(reply).toEqual({ kind: 'none' });
    });

    it('finds nothing for an edition without a picture', async () => {
        const { source } = inventaire(
            JSON.stringify({
                entities: { 'inv:1': { image: {} } },
                redirects: { 'isbn:9782723471930': 'inv:1' },
            }),
        );

        const reply = await SourceProbe.one(source, '9782723471930');

        expect(reply).toEqual({ kind: 'none' });
    });

    it('reads an edition listed under its ISBN, without a redirect', async () => {
        const { source } = inventaire(
            JSON.stringify({
                entities: { 'isbn:9782723471930': { image: { url: '/img/entities/abc' } } },
                redirects: {},
            }),
        );

        const reply = await SourceProbe.one(source, '9782723471930');

        expect(reply).toMatchObject({
            kind: 'found',
            value: [{ address: 'https://inventaire.io/img/entities/abc' }],
        });
    });

    it('asks for several ISBNs in one request', async () => {
        const { source, requests } = inventaire(recorded('inventaire-three-of-four.json'));

        await source.find(
            ['9782723456364', '9782811209124', '9782800100173', '9782253917502'],
            SourceProbe.turn,
        );

        expect(requests).toHaveLength(1);
        expect(new URL(requests[0]!).searchParams.get('uris')).toBe(
            'isbn:9782723456364|isbn:9782811209124|isbn:9782800100173|isbn:9782253917502',
        );
    });

    it('gives each ISBN of a batch its own picture and leaves out the unknown one', async () => {
        const { source } = inventaire(recorded('inventaire-three-of-four.json'));

        const reply = await source.find(
            ['9782253917502', '9782800100173', '9782811209124', '9782723456364'],
            SourceProbe.turn,
        );

        expect(reply).toEqual({
            kind: 'found',
            value: new Map([
                [
                    '9782800100173',
                    [
                        {
                            address:
                                'https://inventaire.io/img/entities/b57fdfc294e77f9fe72dccbffef664e60af0ed66',
                            width: null,
                            height: null,
                            fingerprint: null,
                        },
                    ],
                ],
                [
                    '9782811209124',
                    [
                        {
                            address:
                                'https://inventaire.io/img/entities/78fefdeaabbc6954d57444305e0750047d55c14c',
                            width: null,
                            height: null,
                            fingerprint: null,
                        },
                    ],
                ],
                [
                    '9782723456364',
                    [
                        {
                            address:
                                'https://inventaire.io/img/entities/da8bcab7293460f0c5a28017f88d5fb35aa8713c',
                            width: null,
                            height: null,
                            fingerprint: null,
                        },
                    ],
                ],
            ]),
        });
    });

    it('takes ten ISBNs at most in one request', () => {
        const { source } = inventaire('{}');

        expect(source.batchSize).toBe(10);
    });

    it('hands back the time Inventaire asks to wait', async () => {
        const { source } = inventaire('', 429, { 'Retry-After': '120' });

        const reply = await SourceProbe.one(source, '9782723471930');

        expect(reply.kind).toBe('limited');
    });

    it('fails on an error answer', async () => {
        const { source } = inventaire('', 500);

        const reply = SourceProbe.one(source, '9782723471930');

        await expect(reply).rejects.toThrow('answered 500');
    });
});
