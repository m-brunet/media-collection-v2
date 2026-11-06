import { describe, expect, it } from 'vitest';
import { OpenLibraryCovers } from './open-library-covers.adapter.js';
import { OpenLibraryRecords } from './open-library-records.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

function covers(record: object) {
    const body = JSON.stringify({ 'ISBN:9782253164692': record });
    const http = new SourceHttp(async () => new Response(body, { status: 200 }));

    return new OpenLibraryCovers(new OpenLibraryRecords(http));
}

describe('OpenLibraryCovers', () => {
    it('offers the largest cover, by its cover id', async () => {
        const source = covers({
            cover: {
                medium: 'https://covers.openlibrary.org/b/id/11376002-M.jpg',
                large: 'https://covers.openlibrary.org/b/id/11376002-L.jpg',
            },
        });

        const reply = await source.find('9782253164692');

        expect(reply).toEqual({
            kind: 'found',
            value: [
                {
                    address: 'https://covers.openlibrary.org/b/id/11376002-L.jpg',
                    width: null,
                    height: null,
                    fingerprint: null,
                },
            ],
        });
    });

    it('offers nothing for an edition without a cover', async () => {
        const source = covers({ title: "La quête d'Ewilan" });

        const reply = await source.find('9782253164692');

        expect(reply).toEqual({ kind: 'none' });
    });
});
