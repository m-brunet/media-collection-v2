import { describe, expect, it } from 'vitest';
import type { VolumeCoverDto } from '../../../../../packages/contracts/src/http';
import type { VolumeCovers } from './volume-cover-queue';
import { VolumeCoverQueue } from './volume-cover-queue';

function setup(replies: Record<string, VolumeCoverDto[]>, wanted: string[], sleeps = 3) {
    const asked: string[] = [];
    const waits: number[] = [];
    const arrivals: VolumeCovers[] = [];
    const queue: VolumeCoverQueue = new VolumeCoverQueue(
        () => wanted,
        async (isbn) => {
            asked.push(isbn);

            return replies[isbn]?.shift() ?? { kind: 'none' };
        },
        async (milliseconds) => {
            waits.push(milliseconds);

            if (waits.length >= sleeps) {
                queue.stop();
            }
        },
        () => Date.parse('2026-03-01T10:00:00Z'),
        (covers) => arrivals.push(covers),
    );

    return { queue, asked, waits, arrivals };
}

describe('VolumeCoverQueue', () => {
    it('asks one cover at a time, six seconds apart, in the order wanted', async () => {
        const { queue, asked, waits, arrivals } = setup(
            { a: [{ kind: 'found', token: 'token-a' }] },
            ['a', 'b'],
            2,
        );

        await queue.run();

        expect(asked).toEqual(['a', 'b']);
        expect(waits).toEqual([6000, 6000]);
        expect([...arrivals.at(-1)!]).toEqual([
            ['a', { kind: 'found', token: 'token-a' }],
            ['b', { kind: 'none' }],
        ]);
    });

    it('waits until the time given when the source is limited, then asks again', async () => {
        const { queue, asked, waits } = setup(
            {
                a: [
                    { kind: 'limited', retryAt: '2026-03-01T10:03:00Z' },
                    { kind: 'found', token: 'token-a' },
                ],
            },
            ['a'],
            2,
        );

        await queue.run();

        expect(waits).toEqual([180000, 6000]);
        expect(asked).toEqual(['a', 'a']);
    });

    it('waits a few minutes when the time to wait cannot be read', async () => {
        const { queue, waits } = setup({ a: [{ kind: 'limited', retryAt: 'soon' }] }, ['a'], 1);

        await queue.run();

        expect(waits).toEqual([VolumeCoverQueue.fallbackWait]);
    });

    it('counts an unreachable server as no cover', async () => {
        const arrivals: VolumeCovers[] = [];
        const queue: VolumeCoverQueue = new VolumeCoverQueue(
            () => ['a'],
            async () => {
                throw new Error('offline');
            },
            async () => queue.stop(),
            () => 0,
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
        expect(waits).toEqual([6000, 6000, 6000]);
    });
});
