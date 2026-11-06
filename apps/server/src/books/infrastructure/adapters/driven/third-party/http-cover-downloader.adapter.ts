import type { CoverDownloader } from '../../../../application/ports/driven/cover-downloader.interface.js';
import { CoverImage } from '../../../../domain/value-objects/cover-image.value-object.js';
import type { Fetcher } from './source-http.adapter.js';
import { SourceHttp } from './source-http.adapter.js';

// Which addresses a download may reach, checked at every redirect.
export interface AddressPolicy {
    allows(url: URL): Promise<boolean>;
}

// Downloads a cover over HTTP(S), stopping as soon as it exceeds the size a cover may have.
// Redirects are followed one by one (at most `maximumRedirects`) so that `policy` checks each
// address: lookup sources are trusted as they are; an address a person pasted is not.
export class HttpCoverDownloader implements CoverDownloader {
    static readonly maximumRedirects = 3;
    // Lookup sources are trusted: any web address they offer may be downloaded.
    private static readonly anyWebAddress: AddressPolicy = { allows: async () => true };

    constructor(
        private readonly fetcher: Fetcher = fetch,
        private readonly policy: AddressPolicy = HttpCoverDownloader.anyWebAddress,
    ) {}

    async download(address: string): Promise<Uint8Array | null> {
        try {
            let url = new URL(address);

            for (
                let redirects = 0;
                redirects <= HttpCoverDownloader.maximumRedirects;
                redirects++
            ) {
                if (!/^https?:$/.test(url.protocol) || !(await this.policy.allows(url))) {
                    return null;
                }

                const response = await this.fetcher(url.href, {
                    headers: { 'User-Agent': SourceHttp.userAgent, Accept: 'image/*' },
                    signal: AbortSignal.timeout(SourceHttp.timeoutSeconds * 1000),
                    redirect: 'manual',
                });
                const location = response.headers.get('Location');

                if (response.status >= 300 && response.status < 400 && location) {
                    url = new URL(location, url);
                    continue;
                }

                return response.ok && response.body
                    ? await HttpCoverDownloader.read(response.body)
                    : null;
            }

            return null;
        } catch {
            // Justified: an unreachable source or a malformed address only means no cover here.
            return null;
        }
    }

    private static async read(body: ReadableStream<Uint8Array>): Promise<Uint8Array | null> {
        const chunks: Uint8Array[] = [];
        let size = 0;

        for await (const chunk of body) {
            size += chunk.length;

            // Too large for a cover: leaving the loop stops the download.
            if (size > CoverImage.maximumBytes) {
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
