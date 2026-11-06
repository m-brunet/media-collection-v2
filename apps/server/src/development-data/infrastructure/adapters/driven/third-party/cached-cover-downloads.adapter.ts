import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CoverDownloads } from '../../../../application/ports/driven/cover-downloads.interface.js';

// Downloads V1 covers once into a local cache (`local-imports/v1/covers/`, Git-ignored), which
// later imports reuse: re-running the import is fast, works offline and survives dead addresses.
// Only successful downloads are cached, so failed ones are tried again next time. Several covers are
// downloaded at once.
export class CachedCoverDownloads implements CoverDownloads {
    private static readonly maximumBytes = 10 * 1024 * 1024;
    private static readonly timeoutMilliseconds = 20_000;
    private static readonly parallelDownloads = 8;

    constructor(
        private readonly cacheDirectory: string,
        private readonly download: typeof fetch = fetch,
    ) {}

    async fetchAll(urls: readonly string[]): Promise<Map<string, Uint8Array>> {
        const images = new Map<string, Uint8Array>();
        const queue = [...new Set(urls)];
        const worker = async () => {
            for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
                const bytes = await this.fetch(url);

                if (bytes) {
                    images.set(url, bytes);
                }
            }
        };

        await Promise.all(Array.from({ length: CachedCoverDownloads.parallelDownloads }, worker));

        return images;
    }

    private async fetch(url: string): Promise<Uint8Array | null> {
        const inline = url.trim().match(/^data:[^;,]*;base64,(?<data>.*)$/s)?.groups?.data;

        if (inline !== undefined) {
            return new Uint8Array(Buffer.from(inline, 'base64'));
        }

        if (!/^https?:\/\//i.test(url)) {
            return null;
        }

        const file = join(
            this.cacheDirectory,
            createHash('sha256').update(url).digest('hex') + '.image',
        );
        const cached = await this.cached(file);

        if (cached) {
            return cached;
        }

        const bytes = await this.remote(url);

        if (bytes) {
            await mkdir(this.cacheDirectory, { recursive: true });
            await writeFile(file, bytes);
        }

        return bytes;
    }

    private async cached(file: string): Promise<Uint8Array | null> {
        try {
            return new Uint8Array(await readFile(file));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }

            throw error;
        }
    }

    private async remote(url: string): Promise<Uint8Array | null> {
        try {
            const response = await this.download(url, {
                signal: AbortSignal.timeout(CachedCoverDownloads.timeoutMilliseconds),
            });

            if (!response.ok) {
                return null;
            }

            const bytes = new Uint8Array(await response.arrayBuffer());

            return bytes.length > 0 && bytes.length <= CachedCoverDownloads.maximumBytes
                ? bytes
                : null;
        } catch {
            // Justified: an unreachable host or timeout only leaves this book without its cover.
            return null;
        }
    }
}
