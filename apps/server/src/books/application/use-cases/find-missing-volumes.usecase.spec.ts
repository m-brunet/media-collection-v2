import { describe, expect, it } from 'vitest';
import { Author } from '../../domain/entities/author.entity.js';
import type { SeriesEntry } from '../../domain/services/series-volumes.service.js';
import { LookupAnswer } from '../../domain/value-objects/lookup-answer.value-object.js';
import type { LookupAnswerFields } from '../../domain/value-objects/lookup-answer.value-object.js';
import type { CollectionVolumeMember } from '../ports/driven/collection-volumes.interface.js';
import { AuthorMatcher } from '../services/author-matcher.service.js';
import { SeriesLookup } from '../services/series-lookup.service.js';
import { SeriesSearch } from '../services/series-search.service.js';
import {
    BookDoubles,
    guest,
    MemoryCollectionVolumes,
    owner,
    ScriptedSeries,
} from '../testing/book-doubles.test-support.js';
import { FindMissingVolumes } from './find-missing-volumes.usecase.js';

function entry(isbn: string, volume: number, fields: LookupAnswerFields = {}): SeriesEntry {
    return {
        isbns: [isbn],
        subtitle: null,
        answer: LookupAnswer.of({
            title: 'Gunnm. ' + volume,
            authors: ['Yukito Kishiro'],
            publisher: 'Glénat',
            publicationDate: { year: 2000 + volume, month: null },
            pageCount: 200,
            summary: { text: 'Gally ' + volume, language: 'fre' },
            series: { name: 'Gunnm', volume },
            ...fields,
        }),
    };
}

function member(bookId: string, volume: number, isbn: string | null): CollectionVolumeMember {
    return { bookId, volumeFrom: volume, volumeTo: volume, isbn };
}

function page(records: SeriesEntry[], next: number | null = null) {
    return { kind: 'found' as const, value: { records, next } };
}

const one = entry('9782723432931', 1);
const two = entry('9782723434324', 2);
const five = entry('9782723434799', 5);

const gunnm = [
    member('book-1', 1, '9782723432931'),
    member('book-2', 2, '9782723434324'),
    member('book-5', 5, '9782723434799'),
];

function setup(members: CollectionVolumeMember[] = gunnm, category: 'books' | 'manga' = 'manga') {
    const current = BookDoubles.library();
    const series = new ScriptedSeries('bnf');
    const sudoc = new ScriptedSeries('sudoc');
    const collections = new MemoryCollectionVolumes();

    collections.collections.set('gunnm', {
        id: 'gunnm',
        name: 'Gunnm',
        category,
        status: 'unfinished',
        members,
    });

    return {
        current,
        series,
        sudoc,
        collections,
        useCase: new FindMissingVolumes(
            collections,
            new SeriesSearch([new SeriesLookup(series), new SeriesLookup(sudoc)]),
            current.books,
            new AuthorMatcher(current.authors),
            current.publishers,
        ),
    };
}

describe('FindMissingVolumes', () => {
    it('refuses a Guest', async () => {
        const { useCase } = setup();

        const result = useCase.execute(guest, 'gunnm', 8);

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('refuses a Finished collection before asking the catalogue', async () => {
        const { useCase, series, collections } = setup();

        collections.collections.get('gunnm')!.status = 'finished';

        const result = useCase.execute(owner, 'gunnm', 8);

        await expect(result).rejects.toMatchObject({
            code: 'conflict',
            reason: 'collection-finished',
        });
        expect(series.asked).toEqual([]);
    });

    it('refuses a Dropped collection before asking the catalogue', async () => {
        const { useCase, series, collections } = setup();

        collections.collections.get('gunnm')!.status = 'dropped';

        const result = useCase.execute(owner, 'gunnm', 8);

        await expect(result).rejects.toMatchObject({
            code: 'conflict',
            reason: 'collection-dropped',
        });
        expect(series.asked).toEqual([]);
    });

    it('lists every missing number up to the volume asked, gaps included', async () => {
        const { useCase, series } = setup();

        series.editionsReply = { kind: 'found', value: [one, two, five] };

        const result = await useCase.execute(owner, 'gunnm', 8);

        expect(result.kind === 'found' && result.rows.map((row) => row.volume)).toEqual([
            3, 4, 6, 7, 8,
        ]);
    });

    it('anchors on the highest volume the catalogue knows, asked in one request', async () => {
        const { useCase, series } = setup();

        series.editionsReply = { kind: 'found', value: [one, two] };

        const result = await useCase.execute(owner, 'gunnm', 3);

        expect(result).toMatchObject({
            kind: 'found',
            anchor: { bookId: 'book-2', volume: 2 },
            series: 'Gunnm',
        });
        expect(series.asked).toEqual([
            'editions:9782723434799,9782723434324,9782723432931',
            'volumes:Gunnm/Glénat@1',
        ]);
    });

    it('describes each edition found, best first, with the generated title', async () => {
        const { useCase, series, current } = setup();

        await current.authors.create(
            new Author({ id: 'a1', name: 'Yukito Kishirô', createdAt: '2026-03-01T10:00:00Z' }),
        );
        series.editionsReply = { kind: 'found', value: [five] };
        series.pages = [
            page([
                entry('9782344020456', 3, { publicationDate: { year: 2017, month: null } }),
                entry('9782723434775', 3, { title: 'Le corps et l’âme' }),
            ]),
        ];

        const result = await useCase.execute(owner, 'gunnm', 3);

        expect(result.kind === 'found' && result.rows).toEqual([
            {
                volume: 3,
                source: 'bnf',
                generatedTitle: 'Gunnm Vol. 3',
                editions: [
                    {
                        isbn13: '9782723434775',
                        title: 'Le corps et l’âme',
                        subtitle: null,
                        authors: ['Yukito Kishirô'],
                        publishers: ['Glénat'],
                        publicationYear: 2003,
                        pageCount: 200,
                        summary: 'Gally 3',
                        inLibrary: false,
                    },
                    expect.objectContaining({ isbn13: '9782344020456', publicationYear: 2017 }),
                ],
            },
        ]);
    });

    it("offers an edition's publisher, then its publisher's collection, once each", async () => {
        const { useCase, series } = setup();

        series.editionsReply = { kind: 'found', value: [five] };
        series.pages = [
            page([
                entry('9782723434775', 3, { publisherCollection: 'Seinen manga' }),
                entry('9782723434782', 4, { publisherCollection: 'GLENAT' }),
            ]),
        ];

        const result = await useCase.execute(owner, 'gunnm', 4);

        expect(
            result.kind === 'found' &&
                result.rows.map((row) => row.editions.map((edition) => edition.publishers)),
        ).toEqual([[['Glénat', 'Seinen manga']], [['Glénat']]]);
    });

    it('gives no generated title to Books', async () => {
        const { useCase, series } = setup(gunnm, 'books');

        series.editionsReply = { kind: 'found', value: [five] };

        const result = await useCase.execute(owner, 'gunnm', 3);

        expect(result.kind === 'found' && result.rows[0]?.generatedTitle).toBeNull();
    });

    it('shows an edition already in the library', async () => {
        const { useCase, series, current } = setup();

        await BookDoubles.saved(current, { isbn: '9782723434775' });
        series.editionsReply = { kind: 'found', value: [five] };
        series.pages = [page([entry('9782723434775', 3)])];

        const result = await useCase.execute(owner, 'gunnm', 3);

        expect(result.kind === 'found' && result.rows[0]?.editions[0]?.inLibrary).toBe(true);
    });

    it('lists a volume the catalogue does not know without an edition', async () => {
        const { useCase, series } = setup();

        series.editionsReply = { kind: 'found', value: [five] };

        const result = await useCase.execute(owner, 'gunnm', 3);

        expect(result.kind === 'found' && result.rows).toEqual([
            { volume: 3, source: null, generatedTitle: 'Gunnm Vol. 3', editions: [] },
        ]);
    });

    it('reads every page of a long series', async () => {
        const { useCase, series } = setup();

        series.editionsReply = { kind: 'found', value: [five] };
        series.pages = [page([entry('9782723434775', 3)], 1001), page([entry('9782723434782', 4)])];

        const result = await useCase.execute(owner, 'gunnm', 4);

        expect(
            result.kind === 'found' && result.rows.map((row) => row.editions[0]?.isbn13),
        ).toEqual(['9782723434775', '9782723434782']);
        expect(series.asked.at(-1)).toBe('volumes:Gunnm/Glénat@1001');
    });

    it('says the edition is not in the catalogue when no volume is known there', async () => {
        const { useCase } = setup();

        const result = await useCase.execute(owner, 'gunnm', 8);

        expect(result).toEqual({ kind: 'edition-not-found' });
    });

    it('asks nothing for a collection without an ISBN', async () => {
        const { useCase, series } = setup([member('book-1', 1, null)]);

        const result = await useCase.execute(owner, 'gunnm', 8);

        expect(result).toEqual({ kind: 'edition-not-found' });
        expect(series.asked).toEqual([]);
    });

    it('reports a catalogue asking to wait', async () => {
        const { useCase, series } = setup();

        series.editionsReply = { kind: 'limited', retryAt: new Date('2026-03-01T10:05:00Z') };

        const result = await useCase.execute(owner, 'gunnm', 8);

        expect(result).toEqual({
            kind: 'unavailable',
            catalogues: ['bnf'],
            retryAt: '2026-03-01T10:05:00.000Z',
        });
    });

    it('reports an unreachable catalogue', async () => {
        const { useCase, series } = setup();

        series.editionsReply = { kind: 'found', value: [five] };
        series.pages = ['fail'];

        const result = await useCase.execute(owner, 'gunnm', 8);

        expect(result).toEqual({ kind: 'unavailable', catalogues: ['bnf'], retryAt: null });
    });

    it('reports a catalogue whose queue is too long', async () => {
        const { useCase, series } = setup();

        series.editionsReply = { kind: 'busy' };

        const result = await useCase.execute(owner, 'gunnm', 8);

        expect(result).toEqual({ kind: 'unavailable', catalogues: ['bnf'], retryAt: null });
    });

    it('reports a volume list the catalogue was too busy to give', async () => {
        const { useCase, series } = setup();

        series.editionsReply = { kind: 'found', value: [five] };
        series.pages = [{ kind: 'busy' }];

        const result = await useCase.execute(owner, 'gunnm', 8);

        expect(result).toEqual({ kind: 'unavailable', catalogues: ['bnf'], retryAt: null });
    });

    it('hands the cancellation of the search to every catalogue request', async () => {
        const { useCase, series } = setup();
        const cancel = new AbortController();

        series.editionsReply = { kind: 'found', value: [five] };

        await useCase.execute(owner, 'gunnm', 8, cancel.signal);

        expect(series.turns).toEqual([
            { bulk: true, signal: cancel.signal },
            { bulk: true, signal: cancel.signal },
        ]);
    });

    it('refuses more than 200 volumes at once', async () => {
        const { useCase } = setup();

        const result = useCase.execute(owner, 'gunnm', 206);

        await expect(result).rejects.toMatchObject({ reason: 'volumes-too-many' });
    });

    it("offers an edition's publisher under the existing spelling of its key", async () => {
        const { useCase, series, current } = setup();

        await BookDoubles.saved(current, { publisher: 'Kana', isbn: '9780306406157' });
        series.editionsReply = { kind: 'found', value: [five] };
        series.pages = [page([entry('9782723434775', 3, { publisher: 'KANA' })])];

        const result = await useCase.execute(owner, 'gunnm', 3);

        expect(
            result.kind === 'found' &&
                result.rows.map((row) => row.editions.map((edition) => edition.publishers)),
        ).toEqual([[['Kana']]]);
    });

    describe('with the Sudoc after the BnF', () => {
        const three = entry('9782723434775', 3);
        const four = entry('9782723434782', 4);

        it('does not ask the Sudoc when the BnF finds every missing volume', async () => {
            const { useCase, series, sudoc } = setup();

            series.editionsReply = { kind: 'found', value: [five] };
            series.pages = [page([three, four])];

            const result = await useCase.execute(owner, 'gunnm', 4);

            expect(result).toMatchObject({
                catalogues: ['bnf'],
                unavailable: [],
                rows: [{ source: 'bnf' }, { source: 'bnf' }],
            });
            expect(sudoc.asked).toEqual([]);
        });

        it('finds the edition and the volumes on the Sudoc when the BnF has no edition', async () => {
            const { useCase, sudoc } = setup();

            sudoc.editionsReply = { kind: 'found', value: [five] };
            sudoc.pages = [page([three])];

            const result = await useCase.execute(owner, 'gunnm', 3);

            expect(result).toMatchObject({
                kind: 'found',
                anchor: { bookId: 'book-5', volume: 5 },
                catalogues: ['sudoc'],
                rows: [{ volume: 3, source: 'sudoc', editions: [{ isbn13: '9782723434775' }] }],
            });
        });

        it("searches the Sudoc with the BnF's edition when the BnF finds no volume", async () => {
            const { useCase, series, sudoc } = setup();

            series.editionsReply = { kind: 'found', value: [five] };
            sudoc.pages = [page([three])];

            const result = await useCase.execute(owner, 'gunnm', 3);

            expect(result).toMatchObject({
                catalogues: ['bnf', 'sudoc'],
                rows: [{ volume: 3, source: 'sudoc' }],
            });
            expect(sudoc.asked).toEqual(['volumes:Gunnm/Glénat@1']);
        });

        it('asks the Sudoc when the BnF cannot answer, and says the BnF could not', async () => {
            const { useCase, series, sudoc } = setup();

            series.editionsReply = { kind: 'busy' };
            sudoc.editionsReply = { kind: 'found', value: [five] };
            sudoc.pages = [page([three])];

            const result = await useCase.execute(owner, 'gunnm', 3);

            expect(result).toMatchObject({
                kind: 'found',
                catalogues: ['sudoc'],
                unavailable: ['bnf'],
                rows: [{ volume: 3, source: 'sudoc' }],
            });
        });

        it('takes from the Sudoc only the numbers the BnF did not find', async () => {
            const { useCase, series, sudoc } = setup();
            const otherThree = entry('9782344017548', 3);

            series.editionsReply = { kind: 'found', value: [five] };
            series.pages = [page([three])];
            sudoc.pages = [page([otherThree, four])];

            const result = await useCase.execute(owner, 'gunnm', 4);

            expect(result).toMatchObject({
                catalogues: ['bnf', 'sudoc'],
                rows: [
                    { volume: 3, source: 'bnf', editions: [{ isbn13: '9782723434775' }] },
                    { volume: 4, source: 'sudoc', editions: [{ isbn13: '9782723434782' }] },
                ],
            });
        });

        it("keeps the BnF's edition when its volume list fails and the Sudoc answers", async () => {
            const { useCase, series, sudoc } = setup();

            series.editionsReply = { kind: 'found', value: [five] };
            series.pages = ['fail'];
            sudoc.pages = [page([three])];

            const result = await useCase.execute(owner, 'gunnm', 3);

            expect(result).toMatchObject({
                kind: 'found',
                catalogues: ['bnf', 'sudoc'],
                unavailable: ['bnf'],
                rows: [{ volume: 3, source: 'sudoc' }],
            });
        });

        it('says the edition is not found when neither catalogue knows it', async () => {
            const { useCase, series, sudoc } = setup();

            const result = await useCase.execute(owner, 'gunnm', 3);

            expect(result).toEqual({ kind: 'edition-not-found' });
            expect([series.asked.length, sudoc.asked.length]).toEqual([1, 1]);
        });

        it('names both catalogues when neither can answer, with the latest time to retry', async () => {
            const { useCase, series, sudoc } = setup();

            series.editionsReply = { kind: 'limited', retryAt: new Date('2026-03-01T10:05:00Z') };
            sudoc.editionsReply = { kind: 'limited', retryAt: new Date('2026-03-01T10:09:00Z') };

            const result = await useCase.execute(owner, 'gunnm', 3);

            expect(result).toEqual({
                kind: 'unavailable',
                catalogues: ['bnf', 'sudoc'],
                retryAt: '2026-03-01T10:09:00.000Z',
            });
        });

        it('says the Sudoc could not answer beside what the BnF found', async () => {
            const { useCase, series, sudoc } = setup();

            series.editionsReply = { kind: 'found', value: [five] };
            series.pages = [page([three])];
            sudoc.pages = [{ kind: 'busy' }];

            const result = await useCase.execute(owner, 'gunnm', 4);

            expect(result).toMatchObject({
                kind: 'found',
                catalogues: ['bnf'],
                unavailable: ['sudoc'],
                rows: [
                    { volume: 3, source: 'bnf' },
                    { volume: 4, source: null, editions: [] },
                ],
            });
        });

        it('reports the Sudoc unavailable when the BnF knows nothing', async () => {
            const { useCase, sudoc } = setup();

            sudoc.editionsReply = { kind: 'busy' };

            const result = await useCase.execute(owner, 'gunnm', 3);

            expect(result).toEqual({ kind: 'unavailable', catalogues: ['sudoc'], retryAt: null });
        });
    });
});
