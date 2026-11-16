import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { LookupSource } from '../ports/driven/lookup-source.interface.js';
import type { DeskReply } from './source-desk.service.js';
import { SourceDesk } from './source-desk.service.js';

export interface SourceUnavailability {
    source: string;
    reason: 'limited' | 'failed' | 'busy';
}

export interface SourceRecipient<T> {
    found(source: string, value: T): void;
    unavailable(unavailability: SourceUnavailability): void;
    late(source: string): void;
}

export class SourceLink<T> {
    constructor(
        private readonly desk: SourceDesk<T>,
        private readonly next: SourceLink<T> | null = null,
    ) {}

    static chain<T>(sources: readonly LookupSource<T>[], clock: Clock): SourceLink<T> | null {
        return sources.reduceRight<SourceLink<T> | null>(
            (next, source) => new SourceLink(new SourceDesk(source, clock), next),
            null,
        );
    }

    begin(isbn13: string): SourceStep<T> {
        return new SourceStep(
            this.desk.name,
            this.desk.ask(isbn13, false),
            this.next?.begin(isbn13) ?? null,
        );
    }

    request(isbn13: string, bulk: boolean): Promise<DeskReply<T>> {
        return this.desk.ask(isbn13, bulk);
    }
}

export class SourceStep<T> {
    constructor(
        private readonly source: string,
        private readonly reply: Promise<DeskReply<T>>,
        private readonly next: SourceStep<T> | null,
    ) {}

    async handle(recipient: SourceRecipient<T>, deadline: Promise<'late'>): Promise<void> {
        const reply = await Promise.race([this.reply, deadline]);

        if (reply === 'late') {
            recipient.late(this.source);
        } else if (reply === 'failed') {
            recipient.unavailable({ source: this.source, reason: 'failed' });
        } else if (reply.kind === 'found') {
            recipient.found(this.source, reply.value);
        } else if (reply.kind !== 'none') {
            recipient.unavailable({ source: this.source, reason: reply.kind });
        }

        await this.next?.handle(recipient, deadline);
    }
}
