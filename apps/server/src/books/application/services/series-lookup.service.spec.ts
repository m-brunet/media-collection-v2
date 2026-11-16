import { describe, expect, it } from 'vitest';
import { ScriptedSeries } from '../testing/book-doubles.test-support.js';
import { SeriesLookup } from './series-lookup.service.js';

function setup() {
    const series = new ScriptedSeries();

    return { series, lookup: new SeriesLookup(series) };
}

describe('SeriesLookup', () => {
    it('reads every page of a series', async () => {
        const { series, lookup } = setup();

        series.pages = [
            { kind: 'found', value: { records: [], next: 1001 } },
            { kind: 'found', value: { records: [], next: null } },
        ];

        await lookup.volumes('Gunnm', 'Glénat');

        expect(series.asked).toEqual(['volumes:Gunnm/Glénat@1', 'volumes:Gunnm/Glénat@1001']);
    });

    it('stops at the page the catalogue refuses', async () => {
        const { series, lookup } = setup();

        series.pages = [
            { kind: 'found', value: { records: [], next: 1001 } },
            { kind: 'limited', retryAt: null },
        ];

        const reply = await lookup.volumes('Gunnm', 'Glénat');

        expect(reply).toEqual({ kind: 'limited', retryAt: null });
    });

    it('reports a catalogue whose queue is too long as busy', async () => {
        const { series, lookup } = setup();

        series.editionsReply = { kind: 'busy' };

        const reply = await lookup.editions(['9782723434799']);

        expect(reply).toEqual({ kind: 'busy' });
    });

    it('asks as bulk work', async () => {
        const { series, lookup } = setup();

        await lookup.editions(['9782723434799']);

        expect(series.turns).toEqual([{ bulk: true }]);
    });

    it('hands the cancellation of the run to every request', async () => {
        const { series, lookup } = setup();
        const cancel = new AbortController();

        series.pages = [{ kind: 'found', value: { records: [], next: null } }];

        await lookup.volumes('Gunnm', 'Glénat', cancel.signal);

        expect(series.turns).toEqual([{ bulk: true, signal: cancel.signal }]);
    });

    it('reports an unreachable catalogue as failed', async () => {
        const { series, lookup } = setup();

        series.editionsReply = 'fail';

        const reply = await lookup.editions(['9782723434799']);

        expect(reply).toEqual({ kind: 'failed' });
    });
});
