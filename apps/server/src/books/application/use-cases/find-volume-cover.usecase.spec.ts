import { describe, expect, it } from 'vitest';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import type { SourceReply } from '../ports/driven/lookup-source.interface.js';
import { SourceBudgets } from '../services/source-budgets.service.js';
import { SourceLink } from '../services/source-chain.service.js';
import {
    guest,
    ManualClock,
    MemoryCoverRegistry,
    owner,
    ScriptedSource,
} from '../testing/book-doubles.test-support.js';
import { FindVolumeCover } from './find-volume-cover.usecase.js';

const offer: CoverOffer = {
    address: 'https://covers.example/gunnm-3-L.jpg',
    width: null,
    height: null,
    fingerprint: null,
};

function setup(reply: SourceReply<CoverOffer[]> = { kind: 'found', value: [offer] }) {
    const clock = new ManualClock();
    const source = new ScriptedSource('openlibrary', reply, { requests: 20, seconds: 60 });
    const budgets = new SourceBudgets(clock);
    const registry = new MemoryCoverRegistry();

    return {
        clock,
        source,
        budgets,
        registry,
        useCase: new FindVolumeCover(
            SourceLink.chain([source], clock, budgets),
            registry,
            clock,
            FindVolumeCover.half(source.limit),
        ),
    };
}

describe('FindVolumeCover', () => {
    it('refuses a Guest', async () => {
        const { useCase } = setup();

        const result = useCase.execute(guest, '9782723434775');

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('gives a token for the cover found', async () => {
        const { useCase, registry } = setup();

        const result = await useCase.execute(owner, '9782723434775');

        expect(result).toEqual({ kind: 'found', token: 'lookup-cover-1' });
        expect(registry.address('lookup-cover-1')).toBe(offer.address);
    });

    it('finds nothing for a volume without a cover', async () => {
        const { useCase } = setup({ kind: 'none' });

        const result = await useCase.execute(owner, '9782723434775');

        expect(result).toEqual({ kind: 'none' });
    });

    it('spends at most half of the source budget, leaving the rest to single lookups', async () => {
        const { useCase, source, budgets } = setup();

        for (let request = 0; request < 10; request++) {
            await useCase.execute(owner, '9782723434775');
        }

        const eleventh = await useCase.execute(owner, '9782723434775');

        expect(eleventh).toEqual({ kind: 'limited', retryAt: '2026-03-01T10:00:06.000Z' });
        expect(source.asked).toHaveLength(10);
        expect(budgets.of(source).take()).toBe(true);
    });

    it('asks again once the window has moved on', async () => {
        const { useCase, source, clock } = setup();

        for (let request = 0; request < 10; request++) {
            await useCase.execute(owner, '9782723434775');
        }

        clock.advance(61);
        const result = await useCase.execute(owner, '9782723434775');

        expect(result.kind).toBe('found');
        expect(source.asked).toHaveLength(11);
    });

    it('waits as long as the source asks', async () => {
        const { useCase } = setup({ kind: 'limited', retryAt: new Date('2026-03-01T10:03:00Z') });

        const result = await useCase.execute(owner, '9782723434775');

        expect(result).toEqual({ kind: 'limited', retryAt: '2026-03-01T10:03:00.000Z' });
    });

    it('asks nothing while the source is paused', async () => {
        const { useCase, source, budgets } = setup();

        budgets.of(source).pause(new Date('2026-03-01T10:05:00Z'));

        const result = await useCase.execute(owner, '9782723434775');

        expect(result.kind).toBe('limited');
        expect(source.asked).toEqual([]);
    });

    it('refuses an invalid ISBN', async () => {
        const { useCase } = setup();

        const result = useCase.execute(owner, '123');

        await expect(result).rejects.toMatchObject({ reason: 'isbn-invalid' });
    });
});
