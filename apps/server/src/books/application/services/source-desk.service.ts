import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { LookupSource, SourceReply } from '../ports/driven/lookup-source.interface.js';
import { SourceCache } from './source-cache.service.js';

export type DeskReply<T> = SourceReply<T> | 'failed';

type WaitingIsbn<T> = {
    isbn13: string;
    bulk: boolean;
    answer(reply: DeskReply<T>): void;
};

export class SourceDesk<T> {
    private readonly cache: SourceCache<T>;
    private readonly asked = new Map<string, Promise<DeskReply<T>>>();
    private readonly waiting: WaitingIsbn<T>[] = [];
    private sending = false;

    constructor(
        private readonly source: LookupSource<T>,
        clock: Clock,
    ) {
        this.cache = new SourceCache(clock);
    }

    get name(): string {
        return this.source.name;
    }

    ask(isbn13: string, bulk: boolean): Promise<DeskReply<T>> {
        const kept = this.cache.read(isbn13);

        if (kept) {
            return Promise.resolve(kept.reply);
        }

        const known = this.asked.get(isbn13);

        if (known) {
            return known;
        }

        const reply = new Promise<DeskReply<T>>((answer) => {
            const firstBulk = bulk ? -1 : this.waiting.findIndex((entry) => entry.bulk);

            this.waiting.splice(firstBulk < 0 ? this.waiting.length : firstBulk, 0, {
                isbn13,
                bulk,
                answer,
            });
        });

        this.asked.set(isbn13, reply);
        void this.advance();

        return reply;
    }

    private async advance(): Promise<void> {
        if (this.sending || this.waiting.length === 0) {
            return;
        }

        this.sending = true;

        const batch = this.waiting.splice(0, Math.max(1, this.source.batchSize));
        const reply = await this.request(batch);

        for (const entry of batch) {
            const own = SourceDesk.replyFor(reply, entry.isbn13);

            if (own !== 'failed' && (own.kind === 'found' || own.kind === 'none')) {
                this.cache.keep(entry.isbn13, own);
            }

            this.asked.delete(entry.isbn13);
            entry.answer(own);
        }

        this.sending = false;
        void this.advance();
    }

    private async request(
        batch: readonly WaitingIsbn<T>[],
    ): Promise<DeskReply<ReadonlyMap<string, T>>> {
        try {
            return await this.source.find(
                batch.map((entry) => entry.isbn13),
                { bulk: batch.every((entry) => entry.bulk) },
            );
        } catch {
            // Justified: one unreachable source must not stop the lookup; it is reported instead.
            return 'failed';
        }
    }

    private static replyFor<T>(
        reply: DeskReply<ReadonlyMap<string, T>>,
        isbn13: string,
    ): DeskReply<T> {
        if (reply === 'failed' || reply.kind !== 'found') {
            return reply;
        }

        const value = reply.value.get(isbn13);

        return value === undefined ? { kind: 'none' } : { kind: 'found', value };
    }
}
