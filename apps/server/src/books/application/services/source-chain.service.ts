import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { LookupSource, SourceReply } from '../ports/driven/lookup-source.interface.js';
import type { SourceBudget } from './source-budget.service.js';

// Why a source contributed nothing: its rate limit (or our budget for it), or a failure.
export interface SourceUnavailability {
    source: string;
    reason: 'limited' | 'failed';
}

// Receives what each source contributes, in order of preference.
export interface SourceRecipient<T> {
    found(source: string, value: T): void;
    unavailable(unavailability: SourceUnavailability): void;
}

// A chain of responsibility over the lookup sources, in order of preference. Every link adds
// what its source knows and passes the lookup on, so later sources can still complete or offer
// alternatives; a source that is limited, failing or silent passes it on unchanged. All requests
// start together (`begin`); the answers are then handed over in order (`handle`).
export class SourceLink<T> {
    // A source silent for this long counts as failed for this lookup.
    static readonly timeoutSeconds = 8;
    // Pause after "too many requests" without a time given.
    static readonly defaultPauseSeconds = 60;

    constructor(
        private readonly source: LookupSource<T>,
        private readonly budget: SourceBudget,
        private readonly clock: Clock,
        private readonly next: SourceLink<T> | null = null,
    ) {}

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

// One link's request under way, followed by the rest of the chain.
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
