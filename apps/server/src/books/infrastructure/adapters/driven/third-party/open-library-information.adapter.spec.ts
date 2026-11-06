import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OpenLibraryInformation } from './open-library-information.adapter.js';
import { OpenLibraryRecords } from './open-library-records.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

function information(body: string) {
    const http = new SourceHttp(async () => new Response(body, { status: 200 }));

    return new OpenLibraryInformation(new OpenLibraryRecords(http));
}

function dated(publishDate: string) {
    return information(
        JSON.stringify({ 'ISBN:9781635575637': { title: 'Piranesi', publish_date: publishDate } }),
    );
}

describe('OpenLibraryInformation', () => {
    it('reads a recorded edition', async () => {
        const body = readFileSync(
            new URL('./fixtures/open-library-ewilan-1.json', import.meta.url),
            'utf8',
        );

        const reply = await information(body).find('9782253164692');

        expect(reply).toMatchObject({
            kind: 'found',
            value: {
                title: "La quête d'Ewilan",
                authors: ['Pierre Bottero', 'Jean-Louis Thouard'],
                publisher: 'Le livre de poche',
                publicationDate: { year: 2012, month: null },
                editionLanguage: null,
                summary: null,
            },
        });
    });

    it('reads a month written in words', async () => {
        const reply = await dated('March 2012').find('9781635575637');

        expect(reply).toMatchObject({ value: { publicationDate: { year: 2012, month: 3 } } });
    });

    it('reads a full date, keeping its month and year', async () => {
        const reply = await dated('2012-03-01').find('9781635575637');

        expect(reply).toMatchObject({ value: { publicationDate: { year: 2012, month: 3 } } });
    });

    it('ignores a date without a year', async () => {
        const reply = await dated('unknown').find('9781635575637');

        expect(reply).toMatchObject({ value: { publicationDate: null } });
    });

    it('finds nothing in a record without any usable value', async () => {
        const reply = await information(JSON.stringify({ 'ISBN:9781635575637': {} })).find(
            '9781635575637',
        );

        expect(reply).toEqual({ kind: 'none' });
    });
});
