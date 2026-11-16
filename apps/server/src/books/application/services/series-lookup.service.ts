import type { SourceReply, SourceTurn } from '../ports/driven/lookup-source.interface.js';
import type { SeriesCatalogue, SeriesRecord } from '../ports/driven/series-catalogue.interface.js';

export type SeriesReply = SourceReply<SeriesRecord[]> | { kind: 'failed' };

export class SeriesLookup {
    constructor(private readonly catalogue: SeriesCatalogue) {}

    editions(isbn13s: readonly string[], signal?: AbortSignal): Promise<SeriesReply> {
        return this.ask(() => this.catalogue.editions(isbn13s, SeriesLookup.turn(signal)));
    }

    async volumes(series: string, publisher: string, signal?: AbortSignal): Promise<SeriesReply> {
        const records: SeriesRecord[] = [];
        let start: number | null = 1;

        while (start !== null) {
            const from: number = start;
            const page = await this.ask(() =>
                this.catalogue.volumes(series, publisher, from, SeriesLookup.turn(signal)),
            );

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
        try {
            return await request();
        } catch {
            // Justified: an unreachable catalogue is reported to the person instead of failing.
            return { kind: 'failed' };
        }
    }

    private static turn(signal: AbortSignal | undefined): SourceTurn {
        return { bulk: true, ...(signal ? { signal } : {}) };
    }
}
