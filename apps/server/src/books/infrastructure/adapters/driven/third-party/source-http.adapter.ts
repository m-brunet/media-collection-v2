import type {
    SourceRefusal,
    SourceTurn,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import { SourceQueue } from '../../../../application/services/source-queue.service.js';

export type Fetcher = (
    url: string,
    init: { headers: Record<string, string>; signal: AbortSignal; redirect?: RequestRedirect },
) => Promise<Response>;

export type SourceResponse = { kind: 'ok'; response: Response } | SourceRefusal;

export class SourceHttp {
    static readonly timeoutSeconds = SourceQueue.timeoutSeconds;
    static readonly userAgent =
        'MediaCollection (+https://github.com/m-brunet/media-collection-v2)';

    constructor(
        private readonly queue: SourceQueue,
        private readonly fetcher: Fetcher = fetch,
        private readonly now: () => Date = () => new Date(),
    ) {}

    async get(url: string, accept: string, turn: SourceTurn): Promise<SourceResponse> {
        const outcome = await this.queue.send(turn, async () => {
            const answer = await this.fetcher(url, {
                headers: { 'User-Agent': SourceHttp.userAgent, Accept: accept },
                signal: AbortSignal.timeout(SourceHttp.timeoutSeconds * 1000),
            });

            if (SourceHttp.limited(answer)) {
                this.queue.pause(this.retryAt(answer.headers.get('Retry-After')));
            }

            return answer;
        });

        if (outcome.kind !== 'sent') {
            return outcome;
        }

        const response = outcome.value;

        if (SourceHttp.limited(response)) {
            return { kind: 'limited', retryAt: this.retryAt(response.headers.get('Retry-After')) };
        }

        if (!response.ok) {
            throw new Error(url + ' answered ' + response.status);
        }

        return { kind: 'ok', response };
    }

    private static limited(response: Response): boolean {
        return response.status === 429 || response.status === 503;
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
