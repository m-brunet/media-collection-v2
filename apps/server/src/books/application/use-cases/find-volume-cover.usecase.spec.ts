import { describe, expect, it } from 'vitest';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import type { SourceReply } from '../ports/driven/lookup-source.interface.js';
import { SourceLink } from '../services/source-chain.service.js';
import {
    BookDoubles,
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

function setup(reply: SourceReply<CoverOffer[]> | 'fail' = { kind: 'found', value: [offer] }) {
    const source = new ScriptedSource('openlibrary', reply);
    const registry = new MemoryCoverRegistry();
    const { kept, keptStore } = BookDoubles.library();

    return {
        source,
        registry,
        keptStore,
        useCase: new FindVolumeCover(SourceLink.chain([source], new ManualClock()), registry, kept),
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

    it('asks as bulk work, behind single-book lookups', async () => {
        const { useCase, source } = setup();

        await useCase.execute(owner, '9782723434775');

        expect(source.turns).toEqual([{ bulk: true }]);
    });

    it('asks once for a volume whose cover was already searched', async () => {
        const { useCase, source } = setup();

        await useCase.execute(owner, '9782723434775');

        await useCase.execute(owner, '9782723434775');

        expect(source.requests).toHaveLength(1);
    });

    it('gives no cover when the source asked to wait', async () => {
        const { useCase } = setup({ kind: 'limited', retryAt: new Date('2026-03-01T10:03:00Z') });

        const result = await useCase.execute(owner, '9782723434775');

        expect(result).toEqual({ kind: 'none' });
    });

    it('gives no cover when the queue of the source is too long', async () => {
        const { useCase } = setup({ kind: 'busy' });

        const result = await useCase.execute(owner, '9782723434775');

        expect(result).toEqual({ kind: 'none' });
    });

    it('gives no cover when the source is unreachable', async () => {
        const { useCase } = setup('fail');

        const result = await useCase.execute(owner, '9782723434775');

        expect(result).toEqual({ kind: 'none' });
    });

    it('takes the cover of the next source when the preferred one has none', async () => {
        const inventaire = new ScriptedSource<CoverOffer[]>('inventaire', { kind: 'none' });
        const openLibrary = new ScriptedSource<CoverOffer[]>('openlibrary', {
            kind: 'found',
            value: [offer],
        });
        const registry = new MemoryCoverRegistry();
        const useCase = new FindVolumeCover(
            SourceLink.chain([inventaire, openLibrary], new ManualClock()),
            registry,
            BookDoubles.library().kept,
        );

        const result = await useCase.execute(owner, '9782723434775');

        expect(result).toEqual({ kind: 'found', token: 'lookup-cover-1' });
        expect(registry.address('lookup-cover-1')).toBe(offer.address);
    });

    it('does not ask the next source when the preferred one has a cover', async () => {
        const inventaire = new ScriptedSource<CoverOffer[]>('inventaire', {
            kind: 'found',
            value: [offer],
        });
        const openLibrary = new ScriptedSource<CoverOffer[]>('openlibrary', { kind: 'none' });
        const useCase = new FindVolumeCover(
            SourceLink.chain([inventaire, openLibrary], new ManualClock()),
            new MemoryCoverRegistry(),
            BookDoubles.library().kept,
        );

        await useCase.execute(owner, '9782723434775');

        expect(openLibrary.asked).toEqual([]);
    });

    it('gives no cover without a cover source', async () => {
        const useCase = new FindVolumeCover(
            null,
            new MemoryCoverRegistry(),
            BookDoubles.library().kept,
        );

        const result = await useCase.execute(owner, '9782723434775');

        expect(result).toEqual({ kind: 'none' });
    });

    it('gives the cover kept for the ISBN, without asking any source', async () => {
        const source = new ScriptedSource<CoverOffer[]>('inventaire', {
            kind: 'found',
            value: [offer],
        });
        const current = BookDoubles.library();
        const registry = new MemoryCoverRegistry();
        const file = await current.covers.store(new Uint8Array([1]), 'image/png');

        await current.kept.keep('9782723434775', file);

        const result = await new FindVolumeCover(
            SourceLink.chain([source], new ManualClock()),
            registry,
            current.kept,
        ).execute(owner, '9782723434775');

        expect(result).toEqual({ kind: 'found', token: 'lookup-cover-1' });
        expect(registry.address('lookup-cover-1')).toBe('kept:' + file);
        expect(source.asked).toEqual([]);
    });

    it('refuses an invalid ISBN', async () => {
        const { useCase } = setup();

        const result = useCase.execute(owner, '123');

        await expect(result).rejects.toMatchObject({ reason: 'isbn-invalid' });
    });
});
