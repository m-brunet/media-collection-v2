import type {
    SourceReply,
    SourceTurn,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type {
    SeriesCatalogue,
    SeriesPage,
    SeriesRecord,
} from '../../../../application/ports/driven/series-catalogue.interface.js';
import type { SourceHttp } from './source-http.adapter.js';
import { SudocSru } from './sudoc-sru.adapter.js';
import type { UnimarcRecord } from './unimarc-record.adapter.js';

export class SudocSeries implements SeriesCatalogue {
    static readonly maximumEditionPages = 2;
    private static readonly operators: readonly string[] = ['and', 'or', 'not'];

    readonly name = 'sudoc';

    private readonly sru: SudocSru;

    constructor(http: SourceHttp, address = SudocSru.address) {
        this.sru = new SudocSru(http, address);
    }

    async editions(
        isbn13s: readonly string[],
        turn: SourceTurn,
    ): Promise<SourceReply<SeriesRecord[]>> {
        if (isbn13s.length === 0) {
            return { kind: 'none' };
        }

        const query = isbn13s.map((isbn13) => 'isb=' + isbn13).join(' or ');
        const records: SeriesRecord[] = [];

        for (let page = 0; page < SudocSeries.maximumEditionPages; page++) {
            const found = await this.sru.search(query, turn, page * SudocSru.pageSize + 1);

            if (found.kind !== 'ok') {
                return found;
            }

            records.push(...found.records.map(SudocSeries.record));

            if (found.records.length === 0 || records.length >= found.total) {
                break;
            }
        }

        return records.length === 0 ? { kind: 'none' } : { kind: 'found', value: records };
    }

    async volumes(
        series: string,
        publisher: string,
        start: number,
        turn: SourceTurn,
    ): Promise<SourceReply<SeriesPage>> {
        const title = SudocSeries.term(series);
        const name = SudocSeries.term(publisher);

        if (!title || !name) {
            return { kind: 'none' };
        }

        const page = await this.sru.search('mti=' + title + ' and edi=' + name, turn, start);

        if (page.kind !== 'ok') {
            return page;
        }

        if (page.records.length === 0) {
            return { kind: 'none' };
        }

        const next = start + SudocSru.pageSize;

        return {
            kind: 'found',
            value: {
                records: page.records.map(SudocSeries.record),
                next: next <= page.total ? next : null,
            },
        };
    }

    private static record(record: UnimarcRecord): SeriesRecord {
        return { isbns: record.isbns, subtitle: record.subtitle, answer: record.answer };
    }

    private static term(value: string): string {
        return value
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
            .split(' ')
            .filter(
                (word) =>
                    /[\p{L}\p{N}]/u.test(word) &&
                    !SudocSeries.operators.includes(word.toLowerCase()),
            )
            .join(' ');
    }
}
