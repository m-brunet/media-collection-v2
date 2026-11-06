import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonV1Dump } from './json-v1-dump.adapter.js';

const book = {
    _id: { $oid: '587ba8f8152f33d037131950' },
    cover: 'http://example.test/cover.jpg',
    title: 'Magicien - L’apprenti',
    price: { $numberDouble: '9.9' },
    publisher: 'Milady',
    volume: { $numberInt: '1' },
    collectionName: 'La guerre de la faille',
    isbn: '9782811211554',
    type: 'book',
    created: { $date: { $numberLong: '1484499192369' } },
    lastElement: false,
    customFields: [],
    bookRate: { $numberInt: '0' },
    pageCount: { $numberInt: '470' },
    bought: true,
    read: 'READ',
    publishingDate: null,
    authors: ['Raymond E. Feist'],
    __v: { $numberInt: '0' },
};

describe('JsonV1Dump', () => {
    let directory: string;
    let source: string;

    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'v1-dump-'));
        source = join(directory, 'books.json');
    });
    afterEach(async () => {
        await rm(directory, { recursive: true, force: true });
    });

    it('decodes the MongoDB Extended JSON of each book', async () => {
        await writeFile(source, JSON.stringify([book]));

        const result = await new JsonV1Dump(source).read();

        expect(result.books).toEqual([
            {
                record: 1,
                title: 'Magicien - L’apprenti',
                isbn: '9782811211554',
                authors: ['Raymond E. Feist'],
                type: 'book',
                bought: true,
                read: 'READ',
                volume: 1,
                collectionName: 'La guerre de la faille',
                lastElement: false,
                pageCount: 470,
                price: 9.9,
                publisher: 'Milady',
                cover: 'http://example.test/cover.jpg',
                created: '2017-01-15T16:53:12.369Z',
            },
        ]);
    });
    it('reads absent properties as unknown', async () => {
        const {
            title: _title,
            isbn: _isbn,
            volume: _volume,
            collectionName: _name,
            ...rest
        } = book;

        await writeFile(source, JSON.stringify([rest]));

        const result = await new JsonV1Dump(source).read();

        expect(result.books[0]).toMatchObject({
            title: null,
            isbn: null,
            volume: null,
            collectionName: null,
        });
    });
    it('has no corrections when their files are absent', async () => {
        await writeFile(source, JSON.stringify([]));

        const result = await new JsonV1Dump(source).read();

        expect(result.corrections).toEqual({ isbns: [], categories: [] });
    });
    it('reads the corrections kept beside the dump', async () => {
        await writeFile(source, JSON.stringify([]));
        await writeFile(
            join(directory, 'isbn-corrections.json'),
            JSON.stringify([{ record: 11, title: 'Edge of Destiny', isbn: '9781416589471' }]),
        );
        await writeFile(
            join(directory, 'category-corrections.json'),
            JSON.stringify({ Gunnm: 'manga' }),
        );

        const result = await new JsonV1Dump(source).read();

        expect(result.corrections).toEqual({
            isbns: [{ record: 11, title: 'Edge of Destiny', isbn: '9781416589471' }],
            categories: [{ collection: 'Gunnm', category: 'manga' }],
        });
    });
    it('refuses an unknown corrected category', async () => {
        await writeFile(source, JSON.stringify([]));
        await writeFile(
            join(directory, 'category-corrections.json'),
            JSON.stringify({ Gunnm: 'anime' }),
        );
        const dump = new JsonV1Dump(source);

        const result = dump.read();

        await expect(result).rejects.toThrow('"Gunnm" must be "books", "manga" or "comics"');
    });
    it('refuses a dump that is not an array', async () => {
        await writeFile(source, JSON.stringify(book));
        const dump = new JsonV1Dump(source);

        const result = dump.read();

        await expect(result).rejects.toThrow('not a JSON array');
    });
});
