import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SourceProbe } from '../../../../application/testing/book-doubles.test-support.js';
import { OpenLibraryInformation } from './open-library-information.adapter.js';
import { OpenLibraryRecords } from './open-library-records.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

function information(body: string) {
    const http = new SourceHttp(
        SourceProbe.queue(),
        async () => new Response(body, { status: 200 }),
    );

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

        const reply = await SourceProbe.one(information(body), '9782253164692');

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

    it('reads a manga from its subjects', async () => {
        const body = readFileSync(
            new URL('./fixtures/open-library-demon-slayer-1.json', import.meta.url),
            'utf8',
        );

        const reply = await SourceProbe.one(information(body), '9781974700523');

        expect(reply).toMatchObject({ value: { category: 'manga' } });
    });

    it('reads a comic from its subjects', async () => {
        const body = readFileSync(
            new URL('./fixtures/open-library-watchmen.json', import.meta.url),
            'utf8',
        );

        const reply = await SourceProbe.one(information(body), '9781401248192');

        expect(reply).toMatchObject({ value: { category: 'comics' } });
    });

    it('gives no category for a novel', async () => {
        const body = readFileSync(
            new URL('./fixtures/open-library-ewilan-1.json', import.meta.url),
            'utf8',
        );

        const reply = await SourceProbe.one(information(body), '9782253164692');

        expect(reply).toMatchObject({ value: { category: null } });
    });

    it('reads a month written in words', async () => {
        const reply = await SourceProbe.one(dated('March 2012'), '9781635575637');

        expect(reply).toMatchObject({ value: { publicationDate: { year: 2012, month: 3 } } });
    });

    it('reads a full date, keeping its month and year', async () => {
        const reply = await SourceProbe.one(dated('2012-03-01'), '9781635575637');

        expect(reply).toMatchObject({ value: { publicationDate: { year: 2012, month: 3 } } });
    });

    it('ignores a date without a year', async () => {
        const reply = await SourceProbe.one(dated('unknown'), '9781635575637');

        expect(reply).toMatchObject({ value: { publicationDate: null } });
    });

    it('finds nothing in a record without any usable value', async () => {
        const reply = await SourceProbe.one(
            information(JSON.stringify({ 'ISBN:9781635575637': {} })),
            '9781635575637',
        );

        expect(reply).toEqual({ kind: 'none' });
    });
});
