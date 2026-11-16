import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SourceTurn } from '../ports/driven/lookup-source.interface.js';
import type { QueueOutcome } from './source-queue.service.js';
import { SourceQueue } from './source-queue.service.js';

const single: SourceTurn = { bulk: false };
const bulk: SourceTurn = { bulk: true };

function setup(delaySeconds = 10) {
    const started: string[] = [];
    const queue = new SourceQueue(delaySeconds, { now: () => new Date() });
    const send = (name: string, turn: SourceTurn = single): Promise<QueueOutcome<string>> =>
        queue.send(turn, async () => {
            started.push(name + '@' + Date.now() / 1000);

            return name;
        });
    const hang = (): Promise<QueueOutcome<string>> =>
        queue.send(single, () => new Promise<string>(() => undefined));

    return { queue, started, send, hang };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('SourceQueue', () => {
    it('sends the first request at once', async () => {
        const { send } = setup();

        const outcome = await send('a');

        expect(outcome).toEqual({ kind: 'sent', value: 'a' });
    });

    it('keeps the delay between the end of a request and the start of the next', async () => {
        const { send, started } = setup(10);

        void send('a');
        void send('b');
        void send('c');
        await vi.advanceTimersByTimeAsync(25_000);

        expect(started).toEqual(['a@0', 'b@10', 'c@20']);
    });

    it('keeps the delay after a request that was alone', async () => {
        const { send, started } = setup(10);

        await send('a');
        await vi.advanceTimersByTimeAsync(4000);

        void send('b');
        await vi.advanceTimersByTimeAsync(6000);

        expect(started).toEqual(['a@0', 'b@10']);
    });

    it('sends a single-book request before the bulk requests that wait', async () => {
        const { send, started } = setup(10);

        void send('first');
        void send('bulk-1', bulk);
        void send('bulk-2', bulk);
        void send('single');
        await vi.advanceTimersByTimeAsync(35_000);

        expect(started).toEqual(['first@0', 'single@10', 'bulk-1@20', 'bulk-2@30']);
    });

    it('refuses a request at once when the wait is over two minutes', async () => {
        const { send } = setup(50);

        void send('a');
        void send('b');
        void send('c');

        const outcome = await send('d');

        expect(outcome).toEqual({ kind: 'busy' });
    });

    it('counts only single-book requests ahead of a single-book request', async () => {
        const { send, started } = setup(50);

        void send('a');
        void send('bulk-1', bulk);
        void send('bulk-2', bulk);

        void send('single');
        await vi.advanceTimersByTimeAsync(50_000);

        expect(started).toEqual(['a@0', 'single@50']);
    });

    it('drops a request still waiting after two minutes', async () => {
        const { send, hang, started } = setup(10);

        void hang();
        const waiting = send('late');

        await vi.advanceTimersByTimeAsync(SourceQueue.maximumWaitSeconds * 1000);

        const outcome = await waiting;

        expect(outcome).toEqual({ kind: 'busy' });
        expect(started).toEqual([]);
    });

    it('refuses the waiting requests when the service asks to wait', async () => {
        const { queue, send, started } = setup(10);

        void send('a');
        const waiting = send('b');

        queue.pause(new Date(300_000));

        const outcome = await waiting;

        expect(outcome).toEqual({ kind: 'limited', retryAt: new Date(300_000) });
        expect(started).toEqual(['a@0']);
    });

    it('sends nothing before the time the service gave', async () => {
        const { queue, send, started } = setup(10);

        queue.pause(new Date(300_000));
        await vi.advanceTimersByTimeAsync(299_000);

        const outcome = await send('a');

        expect(outcome).toEqual({ kind: 'limited', retryAt: new Date(300_000) });
        expect(started).toEqual([]);
    });

    it('sends again once that time has passed', async () => {
        const { queue, send } = setup(10);

        queue.pause(new Date(300_000));
        await vi.advanceTimersByTimeAsync(300_000);

        const outcome = await send('a');

        expect(outcome).toEqual({ kind: 'sent', value: 'a' });
    });

    it('waits a minute when the service gave no time', async () => {
        const { queue, send } = setup(10);

        queue.pause(null);
        await vi.advanceTimersByTimeAsync((SourceQueue.defaultPauseSeconds - 1) * 1000);

        const outcome = await send('a');

        expect(outcome).toEqual({ kind: 'limited', retryAt: new Date(60_000) });
    });

    it('removes a waiting request that is cancelled', async () => {
        const { queue, send, started } = setup(10);
        const cancel = new AbortController();

        void send('a');
        const waiting = queue.send({ bulk: true, signal: cancel.signal }, async () => {
            started.push('cancelled');

            return 'cancelled';
        });

        cancel.abort();
        await vi.advanceTimersByTimeAsync(30_000);

        const outcome = await waiting;

        expect(outcome).toEqual({ kind: 'busy' });
        expect(started).toEqual(['a@0']);
    });

    it('does not queue a request that is already cancelled', async () => {
        const { queue } = setup(10);
        const cancel = new AbortController();

        cancel.abort();

        const outcome = await queue.send({ bulk: true, signal: cancel.signal }, async () => 'a');

        expect(outcome).toEqual({ kind: 'busy' });
    });

    it('does not send a failed request again and goes on with the next', async () => {
        const { queue, send, started } = setup(10);
        let attempts = 0;

        const failed = queue.send(single, async () => {
            attempts += 1;

            throw new Error('unreachable');
        });
        const failure = expect(failed).rejects.toThrow('unreachable');

        void send('next');
        await vi.advanceTimersByTimeAsync(10_000);
        await failure;

        expect(attempts).toBe(1);
        expect(started).toEqual(['next@10']);
    });

    it('sends without waiting when the delay is zero', async () => {
        const { send, started } = setup(0);

        await send('a');
        await send('b');

        expect(started).toEqual(['a@0', 'b@0']);
    });
});
