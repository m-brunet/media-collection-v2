import { describe, expect, it } from 'vitest';
import type { SourceReply } from '../ports/driven/lookup-source.interface.js';
import { ManualClock, ScriptedSource } from '../testing/book-doubles.test-support.js';
import { SourceDesk } from './source-desk.service.js';

const day = 24 * 60 * 60;
const found = (value: string): SourceReply<string> => ({ kind: 'found', value });

function setup(reply: SourceReply<string> | 'fail' | 'hang' = found('a'), batchSize = 1) {
    const clock = new ManualClock();
    const source = new ScriptedSource<string>('bnf', reply, batchSize);

    return { clock, source, desk: new SourceDesk(source, clock) };
}

describe('SourceDesk', () => {
    it('gives the answer of its source', async () => {
        const { desk } = setup();

        const reply = await desk.ask('9782253164692', false);

        expect(reply).toEqual({ kind: 'found', value: 'a' });
    });

    it('answers from the cache without a new request', async () => {
        const { desk, source } = setup();

        await desk.ask('9782253164692', false);

        const reply = await desk.ask('9782253164692', false);

        expect(reply).toEqual({ kind: 'found', value: 'a' });
        expect(source.requests).toHaveLength(1);
    });

    it('asks again once a found answer is seven days old', async () => {
        const { desk, source, clock } = setup();

        await desk.ask('9782253164692', false);
        clock.advance(7 * day);

        await desk.ask('9782253164692', false);

        expect(source.requests).toHaveLength(2);
    });

    it('keeps a "not found" answer for a day', async () => {
        const { desk, source, clock } = setup({ kind: 'none' });

        await desk.ask('9782253164692', false);
        clock.advance(day - 1);

        const reply = await desk.ask('9782253164692', false);

        expect(reply).toEqual({ kind: 'none' });
        expect(source.requests).toHaveLength(1);
    });

    it('asks again once a "not found" answer is a day old', async () => {
        const { desk, source, clock } = setup({ kind: 'none' });

        await desk.ask('9782253164692', false);
        clock.advance(day);

        await desk.ask('9782253164692', false);

        expect(source.requests).toHaveLength(2);
    });

    it('never keeps a failure', async () => {
        const { desk, source } = setup('fail');

        await desk.ask('9782253164692', false);

        const reply = await desk.ask('9782253164692', false);

        expect(reply).toBe('failed');
        expect(source.requests).toHaveLength(2);
    });

    it('never keeps a limit', async () => {
        const { desk, source } = setup({ kind: 'limited', retryAt: null });

        await desk.ask('9782253164692', false);

        const reply = await desk.ask('9782253164692', false);

        expect(reply).toEqual({ kind: 'limited', retryAt: null });
        expect(source.requests).toHaveLength(2);
    });

    it('never keeps a busy answer', async () => {
        const { desk, source } = setup({ kind: 'busy' });

        await desk.ask('9782253164692', false);

        const reply = await desk.ask('9782253164692', false);

        expect(reply).toEqual({ kind: 'busy' });
        expect(source.requests).toHaveLength(2);
    });

    it('does not send a failed request again by itself', async () => {
        const { desk, source } = setup('fail');

        const reply = await desk.ask('9782253164692', false);

        expect(reply).toBe('failed');
        expect(source.requests).toHaveLength(1);
    });

    it('joins a request already in progress for the same ISBN', async () => {
        const { desk, source } = setup();

        const replies = await Promise.all([
            desk.ask('9782253164692', false),
            desk.ask('9782253164692', false),
        ]);

        expect(replies).toEqual([found('a'), found('a')]);
        expect(source.requests).toEqual([['9782253164692']]);
    });

    it('joins a request in progress that has not answered yet', () => {
        const { desk, source } = setup('hang');

        void desk.ask('9782253164692', false);

        void desk.ask('9782253164692', false);

        expect(source.requests).toEqual([['9782253164692']]);
    });

    it('asks a source one ISBN at a time when it takes no batch', async () => {
        const { desk, source } = setup(found('a'), 1);

        await Promise.all([desk.ask('9782253164692', true), desk.ask('9782723471930', true)]);

        expect(source.requests).toEqual([['9782253164692'], ['9782723471930']]);
    });

    it('groups the waiting ISBNs in one request for a source that takes batches', async () => {
        const { desk, source } = setup(found('a'), 10);

        await Promise.all([
            desk.ask('9782253164692', true),
            desk.ask('9782723471930', true),
            desk.ask('9782845998179', true),
        ]);

        expect(source.requests).toEqual([['9782253164692'], ['9782723471930', '9782845998179']]);
    });

    it('never sends more ISBNs than the batch size', async () => {
        const { desk, source } = setup(found('a'), 2);

        await Promise.all([
            desk.ask('9782253164692', true),
            desk.ask('9782723471930', true),
            desk.ask('9782845998179', true),
            desk.ask('9782075215466', true),
        ]);

        expect(source.requests.map((request) => request.length)).toEqual([1, 2, 1]);
    });

    it('gives each ISBN of a batch its own answer, whatever the order', async () => {
        const { desk, source } = setup(found('a'), 10);

        source.unknown.add('9782723471930');
        void desk.ask('9782253164692', true);

        const replies = await Promise.all([
            desk.ask('9782723471930', true),
            desk.ask('9782845998179', true),
        ]);

        expect(replies).toEqual([{ kind: 'none' }, found('a')]);
    });

    it('reports an ISBN its source left unanswered, next to the ones it answered', async () => {
        const { desk, source } = setup(found('a'), 10);

        source.unsettled.set('9782723471930', { kind: 'limited', retryAt: null });
        void desk.ask('9782253164692', true);

        const replies = await Promise.all([
            desk.ask('9782723471930', true),
            desk.ask('9782845998179', true),
        ]);

        expect(replies).toEqual([{ kind: 'limited', retryAt: null }, found('a')]);
    });

    it('reports an ISBN whose request failed inside a batch as failed', async () => {
        const { desk, source } = setup(found('a'), 10);

        source.unsettled.set('9782723471930', 'failed');

        const reply = await desk.ask('9782723471930', true);

        expect(reply).toBe('failed');
    });

    it('asks again for an ISBN its source left unanswered', async () => {
        const { desk, source } = setup(found('a'), 10);

        source.unsettled.set('9782723471930', 'failed');
        await desk.ask('9782723471930', true);
        source.unsettled.clear();

        const reply = await desk.ask('9782723471930', true);

        expect(reply).toEqual(found('a'));
        expect(source.requests).toHaveLength(2);
    });

    it('sends a single-book ISBN before the bulk ISBNs that wait', async () => {
        const { desk, source } = setup(found('a'), 1);

        void desk.ask('9782253164692', true);
        void desk.ask('9782723471930', true);

        await desk.ask('9782845998179', false);

        expect(source.asked).toEqual(['9782253164692', '9782845998179', '9782723471930']);
    });

    it('asks as a bulk request only when every ISBN of the batch is bulk', async () => {
        const { desk, source } = setup(found('a'), 10);

        void desk.ask('9782253164692', true);

        await Promise.all([desk.ask('9782723471930', true), desk.ask('9782845998179', false)]);

        expect(source.turns).toEqual([{ bulk: true }, { bulk: false }]);
    });
});
