import type { CoverDownloader } from '../../../../application/ports/driven/cover-downloader.interface.js';
import { CoverImage } from '../../../../domain/value-objects/cover-image.value-object.js';
import type { Fetcher } from './source-http.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

// Downloads a cover over HTTP(S), stopping as soon as it exceeds the size a cover may have.
// Only addresses a lookup source offered reach it (see `LookupCoverRegistry`).
export class HttpCoverDownloader implements CoverDownloader {
    constructor(private readonly fetcher: Fetcher = fetch) {}

    async download(address: string): Promise<Uint8Array | null> {
        if (!/^https?:\/\//i.test(address)) {
            return null;
        }

        try {
            const response = await this.fetcher(address, {
                headers: { 'User-Agent': SourceHttp.userAgent, Accept: 'image/*' },
                signal: AbortSignal.timeout(SourceHttp.timeoutSeconds * 1000),
            });

            if (!response.ok || !response.body) {
                return null;
            }

            return await HttpCoverDownloader.read(response.body);
        } catch {
            // Justified: an unreachable or interrupted source only means this cover is unavailable.
            return null;
        }
    }

    private static async read(body: ReadableStream<Uint8Array>): Promise<Uint8Array | null> {
        const chunks: Uint8Array[] = [];
        let size = 0;

        for await (const chunk of body) {
            size += chunk.length;

            if (size > CoverImage.maximumBytes) {
                await body.cancel();

                return null;
            }

            chunks.push(chunk);
        }

        const bytes = new Uint8Array(size);
        let offset = 0;

        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }

        return bytes;
    }
}
