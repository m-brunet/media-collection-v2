import { describe, expect, it } from 'vitest';
import { CoverImage } from '../../../../domain/value-objects/cover-image.value-object.js';
import { HttpCoverDownloader } from './http-cover-downloader.adapter.js';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

function serving(body: BodyInit | null, status = 200) {
    const requested: string[] = [];
    const downloader = new HttpCoverDownloader(async (url) => {
        requested.push(url);

        return new Response(body, { status });
    });

    return { requested, downloader };
}

describe('HttpCoverDownloader', () => {
    it('downloads the image at the address', async () => {
        const { downloader } = serving(jpeg);

        const bytes = await downloader.download('https://covers.example/1-L.jpg');

        expect(bytes).toEqual(jpeg);
    });

    it('gives nothing when the source answers with an error', async () => {
        const { downloader } = serving(null, 404);

        const bytes = await downloader.download('https://covers.example/1-L.jpg');

        expect(bytes).toBeNull();
    });

    it('stops at an image larger than a cover may be', async () => {
        const { downloader } = serving(new Uint8Array(CoverImage.maximumBytes + 1));

        const bytes = await downloader.download('https://covers.example/huge.jpg');

        expect(bytes).toBeNull();
    });

    it('fetches nothing but web addresses', async () => {
        const { requested, downloader } = serving(jpeg);

        const bytes = await downloader.download('file:///etc/passwd');

        expect(bytes).toBeNull();
        expect(requested).toEqual([]);
    });

    it('gives nothing when the source cannot be reached', async () => {
        const downloader = new HttpCoverDownloader(async () => {
            throw new TypeError('fetch failed');
        });

        const bytes = await downloader.download('https://covers.example/1-L.jpg');

        expect(bytes).toBeNull();
    });
});
