import { describe, expect, it } from 'vitest';
import {
    BookDoubles,
    guest,
    MemoryCoverRegistry,
    owner,
    TableDownloader,
} from '../testing/book-doubles.test-support.js';
import { ReadLookupCover } from './read-lookup-cover.usecase.js';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const address = 'https://covers.example/1-L.jpg';

function registered() {
    const registry = new MemoryCoverRegistry();
    const token = registry.register(address);

    return { registry, token };
}

describe('ReadLookupCover', () => {
    it('gives the cover a lookup offered', async () => {
        const { registry, token } = registered();
        const downloader = new TableDownloader({ [address]: jpeg });

        const cover = await new ReadLookupCover(
            registry,
            downloader,
            BookDoubles.library().kept,
        ).execute(owner, token);

        expect(cover.mediaType).toBe('image/jpeg');
        expect(downloader.requested).toEqual([address]);
    });

    it('reports a token that expired or was never issued', async () => {
        const { registry, token } = registered();
        const downloader = new TableDownloader({ [address]: jpeg });

        registry.forget(token);

        const result = new ReadLookupCover(
            registry,
            downloader,
            BookDoubles.library().kept,
        ).execute(owner, token);

        await expect(result).rejects.toMatchObject({ reason: 'lookup-cover-missing' });
        expect(downloader.requested).toEqual([]);
    });

    it('reports a cover its source no longer provides', async () => {
        const { registry, token } = registered();

        const result = new ReadLookupCover(
            registry,
            new TableDownloader(),
            BookDoubles.library().kept,
        ).execute(owner, token);

        await expect(result).rejects.toMatchObject({ reason: 'lookup-cover-unavailable' });
    });

    it('reports a source that sends something other than a cover image', async () => {
        const { registry, token } = registered();
        const downloader = new TableDownloader({ [address]: new TextEncoder().encode('<html>') });

        const result = new ReadLookupCover(
            registry,
            downloader,
            BookDoubles.library().kept,
        ).execute(owner, token);

        await expect(result).rejects.toMatchObject({ reason: 'lookup-cover-unavailable' });
    });

    it('gives a kept cover from the stored file, without a download', async () => {
        const current = BookDoubles.library();
        const file = await current.covers.store(jpeg, 'image/jpeg');
        const registry = new MemoryCoverRegistry();
        const downloader = new TableDownloader();

        await current.kept.keep('9782253164692', file);
        const offer = await current.kept.offer('9782253164692');
        const token = registry.register(offer!.address);

        const cover = await new ReadLookupCover(registry, downloader, current.kept).execute(
            owner,
            token,
        );

        expect(cover.bytes).toEqual(jpeg);
        expect(downloader.requested).toEqual([]);
    });

    it('reports a kept cover whose file is gone', async () => {
        const current = BookDoubles.library();
        const registry = new MemoryCoverRegistry();

        await current.kept.keep('9782253164692', 'missing.jpg');
        const offer = await current.kept.offer('9782253164692');
        const token = registry.register(offer!.address);

        const result = new ReadLookupCover(registry, new TableDownloader(), current.kept).execute(
            owner,
            token,
        );

        await expect(result).rejects.toMatchObject({ reason: 'lookup-cover-unavailable' });
    });

    it('refuses a Guest', async () => {
        const { registry, token } = registered();
        const downloader = new TableDownloader({ [address]: jpeg });

        const result = new ReadLookupCover(
            registry,
            downloader,
            BookDoubles.library().kept,
        ).execute(guest, token);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(downloader.requested).toEqual([]);
    });
});
