import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { SourceRefusal, SourceTurn } from '../ports/driven/lookup-source.interface.js';

export type QueueOutcome<T> = { kind: 'sent'; value: T } | SourceRefusal;

type WaitingRequest = {
    bulk: boolean;
    start(): void;
    refuse(refusal: SourceRefusal): void;
};

export class SourceQueue {
    static readonly timeoutSeconds = 10;
    static readonly maximumWaitSeconds = 120;
    static readonly defaultPauseSeconds = 60;

    private readonly waiting: WaitingRequest[] = [];
    private sending = false;
    private freeAt = 0;
    private pausedUntil = 0;
    private wake: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly delaySeconds: number,
        private readonly clock: Clock,
    ) {}

    send<T>(turn: SourceTurn, request: () => Promise<T>): Promise<QueueOutcome<T>> {
        const now = this.clock.now().getTime();

        if (now < this.pausedUntil) {
            return Promise.resolve({ kind: 'limited', retryAt: new Date(this.pausedUntil) });
        }

        if (turn.signal?.aborted || this.waitFor(turn.bulk, now) > SourceQueue.maximumWaitSeconds) {
            return Promise.resolve({ kind: 'busy' });
        }

        return new Promise<QueueOutcome<T>>((resolve, reject) => {
            const leave = () => this.remove(entry, { kind: 'busy' });
            const expiry = setTimeout(leave, SourceQueue.maximumWaitSeconds * 1000);
            const settle = () => {
                clearTimeout(expiry);
                turn.signal?.removeEventListener('abort', leave);
            };
            const entry: WaitingRequest = {
                bulk: turn.bulk,
                start: () => {
                    settle();
                    this.run(request).then(resolve, reject);
                },
                refuse: (refusal) => {
                    settle();
                    resolve(refusal);
                },
            };

            turn.signal?.addEventListener('abort', leave);
            this.enter(entry);
            this.advance();
        });
    }

    pause(until: Date | null): void {
        const fallback = this.clock.now().getTime() + SourceQueue.defaultPauseSeconds * 1000;

        this.pausedUntil = Math.max(this.pausedUntil, until?.getTime() ?? fallback);

        for (const entry of this.waiting.splice(0)) {
            entry.refuse({ kind: 'limited', retryAt: new Date(this.pausedUntil) });
        }
    }

    private waitFor(bulk: boolean, now: number): number {
        const ahead = this.waiting.filter((entry) => bulk || !entry.bulk).length;
        const turns = ahead + (this.sending ? 1 : 0);

        return Math.max(0, this.freeAt - now) / 1000 + turns * this.delaySeconds;
    }

    private enter(entry: WaitingRequest): void {
        const firstBulk = entry.bulk ? -1 : this.waiting.findIndex((other) => other.bulk);

        if (firstBulk < 0) {
            this.waiting.push(entry);
        } else {
            this.waiting.splice(firstBulk, 0, entry);
        }
    }

    private remove(entry: WaitingRequest, refusal: SourceRefusal): void {
        const index = this.waiting.indexOf(entry);

        if (index >= 0) {
            this.waiting.splice(index, 1);
            entry.refuse(refusal);
        }
    }

    private advance(): void {
        if (this.sending || this.waiting.length === 0) {
            return;
        }

        const wait = this.freeAt - this.clock.now().getTime();

        if (wait > 0) {
            this.wake ??= setTimeout(() => {
                this.wake = undefined;
                this.advance();
            }, wait);

            return;
        }

        this.sending = true;
        this.waiting.shift()?.start();
    }

    private async run<T>(request: () => Promise<T>): Promise<QueueOutcome<T>> {
        try {
            return { kind: 'sent', value: await request() };
        } finally {
            this.sending = false;
            this.freeAt = this.clock.now().getTime() + this.delaySeconds * 1000;
            this.advance();
        }
    }
}
