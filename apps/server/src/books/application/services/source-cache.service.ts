import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';

export type KeptReply<T> = { kind: 'found'; value: T } | { kind: 'none' };

export type KeptAnswer<T> = { reply: KeptReply<T>; retrievedAt: Date };

export class SourceCache<T> {
    static readonly foundDays = 7;
    static readonly noneDays = 1;
    static readonly maximumEntries = 2000;

    private readonly entries = new Map<string, KeptAnswer<T> & { expiresAt: number }>();

    constructor(private readonly clock: Clock) {}

    read(key: string): KeptAnswer<T> | null {
        const entry = this.entries.get(key);

        if (!entry) {
            return null;
        }

        this.entries.delete(key);

        if (entry.expiresAt <= this.clock.now().getTime()) {
            return null;
        }

        this.entries.set(key, entry);

        return { reply: entry.reply, retrievedAt: entry.retrievedAt };
    }

    keep(key: string, reply: KeptReply<T>): void {
        const retrievedAt = this.clock.now();
        const days = reply.kind === 'found' ? SourceCache.foundDays : SourceCache.noneDays;

        this.entries.delete(key);
        this.entries.set(key, {
            reply,
            retrievedAt,
            expiresAt: retrievedAt.getTime() + days * 24 * 60 * 60 * 1000,
        });

        for (const oldest of this.entries.keys()) {
            if (this.entries.size <= SourceCache.maximumEntries) {
                break;
            }

            this.entries.delete(oldest);
        }
    }
}
