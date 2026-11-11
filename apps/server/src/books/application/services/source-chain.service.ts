import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { LookupSource, SourceReply } from '../ports/driven/lookup-source.interface.js';
import { SourceBudget } from './source-budget.service.js';

export interface SourceUnavailability {
    source: string;
    reason: 'limited' | 'failed';
}

export interface SourceRecipient<T> {
    found(source: string, value: T): void;
    unavailable(unavailability: SourceUnavailability): void;
}

export class SourceLink<T> {
    static readonly timeoutSeconds = 8;
    static readonly defaultPauseSeconds = 60;

    constructor(
        private readonly source: LookupSource<T>,
        private readonly budget: SourceBudget,
        private readonly clock: Clock,
        private readonly next: SourceLink<T> | null = null,
    ) {}

    static chain<T>(sources: readonly LookupSource<T>[], clock: Clock): SourceLink<T> | null {
        return sources.reduceRight<SourceLink<T> | null>(
            (next, source) =>
                new SourceLink(source, new SourceBudget(source.limit, clock), clock, next),
            null,
        );
    }

    begin(isbn13: string): SourceStep<T> {
        return new SourceStep(this.source.name, this.ask(isbn13), this.next?.begin(isbn13) ?? null);
    }

    private async ask(isbn13: string): Promise<SourceReply<T> | 'failed'> {
        if (!this.budget.take()) {
            return { kind: 'limited', retryAt: null };
        }

        let timer: ReturnType<typeof setTimeout> | undefined;

        try {
            const reply = await Promise.race([
                this.source.find(isbn13),
                new Promise<'failed'>((resolve) => {
                    timer = setTimeout(() => resolve('failed'), SourceLink.timeoutSeconds * 1000);
                }),
            ]);

            if (reply !== 'failed' && reply.kind === 'limited') {
                this.budget.pause(
                    reply.retryAt ??
                        new Date(
                            this.clock.now().getTime() + SourceLink.defaultPauseSeconds * 1000,
                        ),
                );
            }

            return reply;
        } catch {
            // Justified: one unreachable source must not stop the lookup; it is reported instead.
            return 'failed';
        } finally {
            clearTimeout(timer);
        }
    }
}

export class SourceStep<T> {
    constructor(
        private readonly source: string,
        private readonly reply: Promise<SourceReply<T> | 'failed'>,
        private readonly next: SourceStep<T> | null,
    ) {}

    async handle(recipient: SourceRecipient<T>): Promise<void> {
        const reply = await this.reply;

        if (reply === 'failed') {
            recipient.unavailable({ source: this.source, reason: 'failed' });
        } else if (reply.kind === 'limited') {
            recipient.unavailable({ source: this.source, reason: 'limited' });
        } else if (reply.kind === 'found') {
            recipient.found(this.source, reply.value);
        }

        await this.next?.handle(recipient);
    }
}
