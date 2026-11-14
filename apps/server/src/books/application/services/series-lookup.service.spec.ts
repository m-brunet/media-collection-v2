import { describe, expect, it } from 'vitest';
import { ManualClock, ScriptedSeries } from '../testing/book-doubles.test-support.js';
import { SeriesLookup } from './series-lookup.service.js';
import { SourceBudget } from './source-budget.service.js';

function setup(requests = 100) {
    const clock = new ManualClock();
    const series = new ScriptedSeries({ requests, seconds: 60 });
    const budget = new SourceBudget(series.limit, clock);

    return { clock, series, budget, lookup: new SeriesLookup(series, budget, clock) };
}

describe('SeriesLookup', () => {
    it('spends one request of the budget per page', async () => {
        const { series, lookup } = setup(1);

        series.pages = [{ kind: 'found', value: { records: [], next: 1001 } }];

        const reply = await lookup.volumes('Gunnm', 'Glénat');

        expect(reply).toEqual({ kind: 'limited', retryAt: null });
        expect(series.asked).toEqual(['volumes:Gunnm/Glénat@1']);
    });

    it('asks nothing more before the time the catalogue asks to wait', async () => {
        const { clock, series, lookup } = setup();

        series.editionsReply = { kind: 'limited', retryAt: new Date('2026-03-01T10:02:00Z') };
        await lookup.editions(['9782723434799']);
        clock.advance(60);

        const reply = await lookup.editions(['9782723434799']);

        expect(reply).toEqual({ kind: 'limited', retryAt: null });
        expect(series.asked).toHaveLength(1);
    });

    it('asks again once that time has passed', async () => {
        const { clock, series, lookup } = setup();

        series.editionsReply = { kind: 'limited', retryAt: new Date('2026-03-01T10:02:00Z') };
        await lookup.editions(['9782723434799']);
        clock.advance(121);
        series.editionsReply = { kind: 'none' };

        const reply = await lookup.editions(['9782723434799']);

        expect(reply).toEqual({ kind: 'none' });
        expect(series.asked).toHaveLength(2);
    });

    it('reports an unreachable catalogue as failed', async () => {
        const { series, lookup } = setup();

        series.editionsReply = 'fail';

        const reply = await lookup.editions(['9782723434799']);

        expect(reply).toEqual({ kind: 'failed' });
    });
});
