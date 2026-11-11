export type Fetcher = (
    url: string,
    init: { headers: Record<string, string>; signal: AbortSignal; redirect?: RequestRedirect },
) => Promise<Response>;

export type SourceResponse =
    | { kind: 'ok'; response: Response }
    | { kind: 'limited'; retryAt: Date | null };

export class SourceHttp {
    static readonly timeoutSeconds = 10;
    static readonly userAgent =
        'MediaCollection (+https://github.com/m-brunet/media-collection-v2)';

    constructor(
        private readonly fetcher: Fetcher = fetch,
        private readonly now: () => Date = () => new Date(),
    ) {}

    async get(url: string, accept: string): Promise<SourceResponse> {
        const response = await this.fetcher(url, {
            headers: { 'User-Agent': SourceHttp.userAgent, Accept: accept },
            signal: AbortSignal.timeout(SourceHttp.timeoutSeconds * 1000),
        });

        if (response.status === 429 || response.status === 503) {
            return { kind: 'limited', retryAt: this.retryAt(response.headers.get('Retry-After')) };
        }

        if (!response.ok) {
            throw new Error(url + ' answered ' + response.status);
        }

        return { kind: 'ok', response };
    }

    // `Retry-After` is either a number of seconds or an HTTP date.
    private retryAt(value: string | null): Date | null {
        if (!value) {
            return null;
        }

        if (/^\d+$/.test(value.trim())) {
            return new Date(this.now().getTime() + Number(value) * 1000);
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }
}
