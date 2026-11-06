import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CachedCoverDownloads } from './cached-cover-downloads.adapter.js';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 1]);

describe('CachedCoverDownloads', () => {
    let directory: string;
    let requests: string[];

    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'v1-covers-'));
        requests = [];
    });
    afterEach(async () => {
        await rm(directory, { recursive: true, force: true });
    });

    function downloads(status = 200, failure?: Error) {
        const download = (async (url: string | URL | Request) => {
            requests.push(String(url));

            if (failure) {
                throw failure;
            }

            return new Response(status === 200 ? jpeg : null, { status });
        }) as typeof fetch;

        return new CachedCoverDownloads(join(directory, 'covers'), download);
    }

    it('downloads a cover and keeps it in the cache', async () => {
        const covers = downloads();

        const result = await covers.fetch('http://example.test/1.jpg');

        expect(result).toEqual(jpeg);
        expect(await readdir(join(directory, 'covers'))).toHaveLength(1);
    });
    it('reuses the cached cover instead of downloading it again', async () => {
        await downloads().fetch('http://example.test/1.jpg');
        const covers = downloads();

        const result = await covers.fetch('http://example.test/1.jpg');

        expect(result).toEqual(jpeg);
        expect(requests).toEqual(['http://example.test/1.jpg']);
    });
    it('gives no cover for a missing image, and caches nothing', async () => {
        const covers = downloads(404);

        const result = await covers.fetch('http://example.test/missing.jpg');

        expect(result).toBeNull();
        await expect(readdir(join(directory, 'covers'))).rejects.toMatchObject({ code: 'ENOENT' });
    });
    it('gives no cover when the host cannot be reached', async () => {
        const covers = downloads(200, new TypeError('fetch failed'));

        const result = await covers.fetch('http://unknown.test/1.jpg');

        expect(result).toBeNull();
    });
    it('decodes an inline data address without downloading', async () => {
        const covers = downloads();
        const url = '\ndata:image/jpeg;base64,' + Buffer.from(jpeg).toString('base64');

        const result = await covers.fetch(url);

        expect(result).toEqual(jpeg);
        expect(requests).toEqual([]);
    });
    it('ignores other kinds of address', async () => {
        const covers = downloads();

        const result = await covers.fetch('file:///etc/passwd');

        expect(result).toBeNull();
        expect(requests).toEqual([]);
    });
});
