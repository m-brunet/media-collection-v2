import { describe, expect, it } from 'vitest';
import type { VolumeCoverDto } from '../../../../../packages/contracts/src/http';
import type { VolumeCovers } from './volume-cover-queue';
import { VolumeCoverQueue } from './volume-cover-queue';

function setup(replies: Record<string, VolumeCoverDto>, wanted: string[], sleeps = 1) {
    const asked: string[] = [];
    const waits: number[] = [];
    const arrivals: VolumeCovers[] = [];
    const queue: VolumeCoverQueue = new VolumeCoverQueue(
        () => wanted,
        async (isbn) => {
            asked.push(isbn);

            return replies[isbn] ?? { kind: 'none' };
        },
        async (milliseconds) => {
            waits.push(milliseconds);

            if (waits.length >= sleeps) {
                queue.stop();
            }
        },
        (covers) => arrivals.push(covers),
    );

    return { queue, asked, waits, arrivals };
}

describe('VolumeCoverQueue', () => {
    it('asks one cover after the other, in the order wanted', async () => {
        const { queue, asked, arrivals } = setup({ a: { kind: 'found', token: 'token-a' } }, [
            'a',
            'b',
        ]);

        await queue.run();

        expect(asked).toEqual(['a', 'b']);
        expect([...arrivals.at(-1)!]).toEqual([
            ['a', { kind: 'found', token: 'token-a' }],
            ['b', { kind: 'none' }],
        ]);
    });

    it('asks the next cover as soon as one has answered: the server paces the sources', async () => {
        const { queue, waits } = setup({}, ['a', 'b']);

        await queue.run();

        expect(waits).toEqual([VolumeCoverQueue.idleWait]);
    });

    it('never asks again for a cover the server did not give', async () => {
        const { queue, asked } = setup({ a: { kind: 'none' } }, ['a'], 3);

        await queue.run();

        expect(asked).toEqual(['a']);
    });

    it('counts an unreachable server as no cover', async () => {
        const arrivals: VolumeCovers[] = [];
        const queue: VolumeCoverQueue = new VolumeCoverQueue(
            () => ['a'],
            async () => {
                throw new Error('offline');
            },
            async () => queue.stop(),
            (covers) => arrivals.push(covers),
        );

        await queue.run();

        expect(arrivals.at(-1)?.get('a')).toEqual({ kind: 'none' });
    });

    it('asks nothing more once stopped', async () => {
        const { queue, asked } = setup({}, ['a', 'b']);

        queue.stop();
        await queue.run();

        expect(asked).toEqual([]);
    });

    it('waits idle while every wanted cover has been asked', async () => {
        const { queue, asked, waits } = setup({}, ['a'], 3);

        await queue.run();

        expect(asked).toEqual(['a']);
        expect(waits).toEqual([1000, 1000, 1000]);
    });
});
