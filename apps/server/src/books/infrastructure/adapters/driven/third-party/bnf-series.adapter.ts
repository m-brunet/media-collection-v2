import type { SourceReply } from '../../../../application/ports/driven/lookup-source.interface.js';
import type {
    SeriesCatalogue,
    SeriesPage,
    SeriesRecord,
} from '../../../../application/ports/driven/series-catalogue.interface.js';
import { BnfSru } from './bnf-sru.adapter.js';
import type { SourceHttp } from './source-http.adapter.js';
import type { UnimarcRecord } from './unimarc-record.adapter.js';

export class BnfSeries implements SeriesCatalogue {
    static readonly pageSize = 1000;

    readonly name = 'bnf';

    private readonly sru: BnfSru;

    constructor(http: SourceHttp, address = BnfSru.address) {
        this.sru = new BnfSru(http, address);
    }

    async editions(isbn13s: readonly string[]): Promise<SourceReply<SeriesRecord[]>> {
        if (isbn13s.length === 0) {
            return { kind: 'none' };
        }

        const page = await this.sru.search(
            isbn13s.map((isbn) => `bib.isbn all "${isbn}"`).join(' or '),
            Math.min(isbn13s.length * 2, BnfSeries.pageSize),
        );

        if (page.kind === 'limited') {
            return page;
        }

        const records = page.records.map(BnfSeries.record);

        return records.length === 0 ? { kind: 'none' } : { kind: 'found', value: records };
    }

    async volumes(
        series: string,
        publisher: string,
        start: number,
    ): Promise<SourceReply<SeriesPage>> {
        const page = await this.sru.search(
            `bib.title all "${BnfSeries.term(series)}" and bib.publisher all "${BnfSeries.term(publisher)}"`,
            BnfSeries.pageSize,
            start,
        );

        if (page.kind === 'limited') {
            return page;
        }

        if (page.records.length === 0) {
            return { kind: 'none' };
        }

        const next = start + BnfSeries.pageSize;

        return {
            kind: 'found',
            value: {
                records: page.records.map(BnfSeries.record),
                next: next <= page.total ? next : null,
            },
        };
    }

    private static record(record: UnimarcRecord): SeriesRecord {
        return { isbns: record.isbns, subtitle: record.subtitle, answer: record.answer };
    }

    private static term(value: string): string {
        return value.replace(/["\\]/g, ' ').trim();
    }
}
