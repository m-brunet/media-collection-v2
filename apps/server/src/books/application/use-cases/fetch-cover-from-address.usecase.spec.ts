import { describe, expect, it } from 'vitest';
import { guest, owner, TableDownloader } from '../testing/book-doubles.test-support.js';
import { FetchCoverFromAddress } from './fetch-cover-from-address.usecase.js';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const address = 'https://images.example/piranesi.png';

describe('FetchCoverFromAddress', () => {
    it('gives the image found at the address', async () => {
        const downloader = new TableDownloader({ [address]: png });

        const cover = await new FetchCoverFromAddress(downloader).execute(owner, '  ' + address);

        expect(cover.mediaType).toBe('image/png');
        expect(downloader.requested).toEqual([address]);
    });

    it('rejects something that is not a web address', async () => {
        const downloader = new TableDownloader();

        const result = new FetchCoverFromAddress(downloader).execute(owner, 'file:///etc/hosts');

        await expect(result).rejects.toMatchObject({ reason: 'cover-address-invalid' });
        expect(downloader.requested).toEqual([]);
    });

    it('reports an address without a usable image', async () => {
        const result = new FetchCoverFromAddress(new TableDownloader()).execute(owner, address);

        await expect(result).rejects.toMatchObject({ reason: 'cover-address-unavailable' });
    });

    it('rejects a file that is not a cover image', async () => {
        const downloader = new TableDownloader({ [address]: new TextEncoder().encode('<html>') });

        const result = new FetchCoverFromAddress(downloader).execute(owner, address);

        await expect(result).rejects.toMatchObject({ reason: 'cover-format' });
    });

    it('refuses a Guest', async () => {
        const downloader = new TableDownloader({ [address]: png });

        const result = new FetchCoverFromAddress(downloader).execute(guest, address);

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(downloader.requested).toEqual([]);
    });
});
