import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { SourceReply } from '../ports/driven/lookup-source.interface.js';
import type { SeriesCatalogue, SeriesRecord } from '../ports/driven/series-catalogue.interface.js';
import type { SourceBudget } from './source-budget.service.js';
import { SourceLink } from './source-chain.service.js';

export type SeriesReply = SourceReply<SeriesRecord[]> | { kind: 'failed' };

export class SeriesLookup {
    constructor(
        private readonly catalogue: SeriesCatalogue,
        private readonly budget: SourceBudget,
        private readonly clock: Clock,
    ) {}

    editions(isbn13s: readonly string[]): Promise<SeriesReply> {
        return this.ask(() => this.catalogue.editions(isbn13s));
    }

    async volumes(series: string, publisher: string): Promise<SeriesReply> {
        const records: SeriesRecord[] = [];
        let start: number | null = 1;

        while (start !== null) {
            const from: number = start;
            const page = await this.ask(() => this.catalogue.volumes(series, publisher, from));

            if (page.kind !== 'found') {
                return records.length > 0 && page.kind === 'none'
                    ? { kind: 'found', value: records }
                    : page;
            }

            records.push(...page.value.records);
            start = page.value.next;
        }

        return records.length === 0 ? { kind: 'none' } : { kind: 'found', value: records };
    }

    private async ask<T>(
        request: () => Promise<SourceReply<T>>,
    ): Promise<SourceReply<T> | { kind: 'failed' }> {
        if (!this.budget.take()) {
            return { kind: 'limited', retryAt: null };
        }

        try {
            const reply = await request();

            if (reply.kind === 'limited') {
                this.budget.pause(
                    reply.retryAt ??
                        new Date(
                            this.clock.now().getTime() + SourceLink.defaultPauseSeconds * 1000,
                        ),
                );
            }

            return reply;
        } catch {
            // Justified: an unreachable catalogue is reported to the person instead of failing.
            return { kind: 'failed' };
        }
    }
}
