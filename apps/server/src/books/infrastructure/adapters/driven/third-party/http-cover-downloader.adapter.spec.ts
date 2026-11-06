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

    it('stops receiving an endless image once it is too large', async () => {
        let cancelled = false;
        const endless = new ReadableStream<Uint8Array>({
            pull: (controller) => controller.enqueue(new Uint8Array(1024 * 1024)),
            cancel: () => {
                cancelled = true;
            },
        });
        const { downloader } = serving(endless);

        const bytes = await downloader.download('https://covers.example/endless.jpg');

        expect(bytes).toBeNull();
        expect(cancelled).toBe(true);
    });

    it('fetches nothing but web addresses', async () => {
        const { requested, downloader } = serving(jpeg);

        const bytes = await downloader.download('file:///etc/passwd');

        expect(bytes).toBeNull();
        expect(requested).toEqual([]);
    });

    it('follows a redirect to the image', async () => {
        const downloader = new HttpCoverDownloader(async (url) =>
            url.endsWith('/old.jpg')
                ? new Response(null, { status: 302, headers: { Location: '/new.jpg' } })
                : new Response(jpeg, { status: 200 }),
        );

        const bytes = await downloader.download('https://covers.example/old.jpg');

        expect(bytes).toEqual(jpeg);
    });

    it('checks every redirect against its address policy', async () => {
        const checked: string[] = [];
        const downloader = new HttpCoverDownloader(
            async () =>
                new Response(null, { status: 302, headers: { Location: 'http://192.168.1.1/' } }),
            {
                allows: async (url) => {
                    checked.push(url.hostname);

                    return url.hostname !== '192.168.1.1';
                },
            },
        );

        const bytes = await downloader.download('https://images.example/cover.jpg');

        expect(bytes).toBeNull();
        expect(checked).toEqual(['images.example', '192.168.1.1']);
    });

    it('gives up after too many redirects', async () => {
        let requests = 0;
        const downloader = new HttpCoverDownloader(async () => {
            requests++;

            return new Response(null, { status: 302, headers: { Location: '/again.jpg' } });
        });

        const bytes = await downloader.download('https://covers.example/loop.jpg');

        expect(bytes).toBeNull();
        expect(requests).toBe(HttpCoverDownloader.maximumRedirects + 1);
    });

    it('gives nothing when the source cannot be reached', async () => {
        const downloader = new HttpCoverDownloader(async () => {
            throw new TypeError('fetch failed');
        });

        const bytes = await downloader.download('https://covers.example/1-L.jpg');

        expect(bytes).toBeNull();
    });
});
