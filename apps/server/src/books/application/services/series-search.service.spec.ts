import { describe, expect, it } from 'vitest';
import type { SeriesEntry } from '../../domain/services/series-volumes.service.js';
import { LookupAnswer } from '../../domain/value-objects/lookup-answer.value-object.js';
import { ScriptedSeries } from '../testing/book-doubles.test-support.js';
import { SeriesLookup } from './series-lookup.service.js';
import { SeriesSearch } from './series-search.service.js';

function entry(isbn: string, volume: number): SeriesEntry {
    return {
        isbns: [isbn],
        subtitle: null,
        answer: LookupAnswer.of({
            title: 'Gunnm. ' + volume,
            publisher: 'Glénat',
            series: { name: 'Gunnm', volume },
        }),
    };
}

function page(records: SeriesEntry[]) {
    return { kind: 'found' as const, value: { records, next: null } };
}

const three = entry('9782723434775', 3);
const four = entry('9782723434782', 4);
const five = entry('9782723434799', 5);
const owned = [{ isbn13: '9782723434799', volume: 5 }];

function setup() {
    const bnf = new ScriptedSeries('bnf');
    const sudoc = new ScriptedSeries('sudoc');

    return {
        bnf,
        sudoc,
        search: new SeriesSearch([new SeriesLookup(bnf), new SeriesLookup(sudoc)]),
    };
}

describe('SeriesSearch', () => {
    it('stops at the first catalogue that finds every wanted volume', async () => {
        const { bnf, sudoc, search } = setup();

        bnf.editionsReply = { kind: 'found', value: [five] };
        bnf.pages = [page([three, four])];

        const result = await search.find(owned, [3, 4]);

        expect([...result.found.values()].map(({ source }) => source)).toEqual(['bnf', 'bnf']);
        expect(sudoc.asked).toEqual([]);
    });

    it('anchors on the first catalogue that knows an owned volume', async () => {
        const { sudoc, search } = setup();

        sudoc.editionsReply = { kind: 'found', value: [five] };

        const result = await search.find(owned, [3]);

        expect(result.anchor).toMatchObject({ source: 'sudoc', edition: { volume: 5 } });
    });

    it("searches the next catalogue with the first one's edition, without asking for it again", async () => {
        const { bnf, sudoc, search } = setup();

        bnf.editionsReply = { kind: 'found', value: [five] };
        sudoc.pages = [page([three])];

        await search.find(owned, [3]);

        expect(sudoc.asked).toEqual(['volumes:Gunnm/Glénat@1']);
    });

    it('keeps the first catalogue that found a volume as its source', async () => {
        const { bnf, sudoc, search } = setup();

        bnf.editionsReply = { kind: 'found', value: [five] };
        bnf.pages = [page([three])];
        sudoc.pages = [page([entry('9782344017548', 3), four])];

        const result = await search.find(owned, [3, 4]);

        expect([result.found.get(3), result.found.get(4)]).toMatchObject([
            { source: 'bnf', editions: [{ isbn13: '9782723434775' }] },
            { source: 'sudoc', editions: [{ isbn13: '9782723434782' }] },
        ]);
    });

    it('finds neither an edition nor a volume when no catalogue knows the series', async () => {
        const { search } = setup();

        const result = await search.find(owned, [3]);

        expect(result).toEqual({ anchor: null, found: new Map(), unavailable: [] });
    });

    it('lists a catalogue that could not answer, with its time to retry', async () => {
        const { bnf, search } = setup();
        const retryAt = new Date('2026-03-01T10:05:00Z');

        bnf.editionsReply = { kind: 'limited', retryAt };

        const result = await search.find(owned, [3]);

        expect(result.unavailable).toEqual([{ name: 'bnf', retryAt }]);
    });

    it('lists a catalogue that failed while giving its volumes', async () => {
        const { bnf, search } = setup();

        bnf.editionsReply = { kind: 'found', value: [five] };
        bnf.pages = ['fail'];

        const result = await search.find(owned, [3]);

        expect(result.unavailable).toEqual([{ name: 'bnf', retryAt: null }]);
    });

    it('hands the cancellation to every catalogue', async () => {
        const { bnf, sudoc, search } = setup();
        const cancel = new AbortController();

        await search.find(owned, [3], cancel.signal);

        expect([...bnf.turns, ...sudoc.turns]).toEqual([
            { bulk: true, signal: cancel.signal },
            { bulk: true, signal: cancel.signal },
        ]);
    });
});
