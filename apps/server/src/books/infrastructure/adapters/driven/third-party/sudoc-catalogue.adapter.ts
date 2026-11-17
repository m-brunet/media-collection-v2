import type {
    LookupSource,
    SourceBatchReply,
    SourceRefusal,
    SourceTurn,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { LookupAnswer } from '../../../../domain/value-objects/lookup-answer.value-object.js';
import type { SourceHttp } from './source-http.adapter.js';
import { SudocSru } from './sudoc-sru.adapter.js';
import { UnimarcRecord } from './unimarc-record.adapter.js';

type Unsettled = SourceRefusal | 'failed';
type Step<T> = { kind: 'ok'; value: T } | { kind: 'stopped'; reason: Unsettled };
type Ppns = { result?: SudocPpn | SudocPpn[]; resultNoHolding?: SudocPpn | SudocPpn[] };
type SudocPpn = { ppn?: string };

// The Sudoc, the union catalogue of French higher-education libraries (ABES). Licence Ouverte:
// free reuse, source credited. No account or key.
//
// Its SRU service (version 1.1, UNIMARC records, index `isb`) takes several ISBNs joined by
// "or" and answers with the full records, but leaves out some records that no library holds.
// Two services of www.sudoc.fr find those: `services/isbn2ppn/{isbn}` gives the record numbers
// (PPN) of an ISBN, under `result` when a library holds the record and `resultNoHolding` when
// none does, and answers 404 when it knows none; `{ppn}.xml` gives one record.
//
// Its robots.txt asks for 5 seconds between requests.
export class SudocCatalogue implements LookupSource<LookupAnswer> {
    static readonly address = SudocSru.address;
    static readonly recordsAddress = 'https://www.sudoc.fr';
    static readonly pageSize = SudocSru.pageSize;
    static readonly maximumPages = 2;
    static readonly maximumPpns = 2;

    readonly name = 'sudoc';
    readonly batchSize = 13;

    private readonly sru: SudocSru;

    constructor(
        private readonly http: SourceHttp,
        address = SudocCatalogue.address,
        private readonly recordsAddress = SudocCatalogue.recordsAddress,
    ) {
        this.sru = new SudocSru(http, address);
    }

    async find(
        isbn13s: readonly string[],
        turn: SourceTurn,
    ): Promise<SourceBatchReply<LookupAnswer>> {
        const asked = [...new Set(isbn13s)];

        if (asked.length === 0) {
            return { kind: 'none' };
        }

        const searched = await this.search(asked, turn);

        if (searched.kind === 'stopped') {
            if (searched.reason === 'failed') {
                throw new Error('The Sudoc search failed');
            }

            return searched.reason;
        }

        const answers = new Map<string, LookupAnswer>();

        for (const record of searched.value) {
            SudocCatalogue.keep(answers, asked, record);
        }

        const unsettled = await this.complete(answers, asked, turn);

        if (unsettled.size > 0) {
            return { kind: 'partial', value: answers, unsettled };
        }

        return answers.size > 0 ? { kind: 'found', value: answers } : { kind: 'none' };
    }

    private async complete(
        answers: Map<string, LookupAnswer>,
        asked: readonly string[],
        turn: SourceTurn,
    ): Promise<Map<string, Unsettled>> {
        const unsettled = new Map<string, Unsettled>();
        const records = new Map<string, UnimarcRecord | null>();
        let stopped: Unsettled | null = null;

        for (const isbn13 of asked.filter((candidate) => !answers.has(candidate))) {
            if (stopped) {
                unsettled.set(isbn13, stopped);

                continue;
            }

            const step = await this.single(isbn13, records, turn);

            if (step.kind === 'stopped') {
                stopped = step.reason;
                unsettled.set(isbn13, stopped);
            } else if (step.value) {
                answers.set(isbn13, step.value);
            }
        }

        return unsettled;
    }

    private async single(
        isbn13: string,
        records: Map<string, UnimarcRecord | null>,
        turn: SourceTurn,
    ): Promise<Step<LookupAnswer | null>> {
        try {
            const ppns = await this.ppns(isbn13, turn);

            if (ppns.kind === 'stopped') {
                return ppns;
            }

            for (const ppn of ppns.value) {
                if (!records.has(ppn)) {
                    const record = await this.record(ppn, turn);

                    if (record.kind === 'stopped') {
                        return record;
                    }

                    records.set(ppn, record.value);
                }

                const answer = records.get(ppn)?.answer;

                if (answer && !answer.empty) {
                    return { kind: 'ok', value: answer };
                }
            }

            return { kind: 'ok', value: null };
        } catch {
            // Justified: the ISBNs the search already matched keep their records; this one is
            // reported as unanswered, and the rest of the batch is not asked one by one.
            return { kind: 'stopped', reason: 'failed' };
        }
    }

    private async search(
        isbn13s: readonly string[],
        turn: SourceTurn,
    ): Promise<Step<UnimarcRecord[]>> {
        const records: UnimarcRecord[] = [];
        const query = isbn13s.map((isbn13) => 'isb=' + isbn13).join(' or ');

        for (let page = 0; page < SudocCatalogue.maximumPages; page++) {
            const found = await this.sru.search(query, turn, page * SudocCatalogue.pageSize + 1);

            if (found.kind !== 'ok') {
                return { kind: 'stopped', reason: found };
            }

            records.push(...found.records);

            if (found.records.length === 0 || records.length >= found.total) {
                break;
            }
        }

        return { kind: 'ok', value: records };
    }

    private async ppns(isbn13: string, turn: SourceTurn): Promise<Step<string[]>> {
        const reply = await this.http.get(
            this.recordsAddress + '/services/isbn2ppn/' + isbn13,
            'text/json',
            turn,
            [404],
        );

        if (reply.kind !== 'ok') {
            return { kind: 'stopped', reason: reply };
        }

        if (reply.response.status === 404) {
            return { kind: 'ok', value: [] };
        }

        const body = (await reply.response.json()) as { sudoc?: { query?: Ppns } };
        const query = body.sudoc?.query ?? {};
        const ppns = [query.result ?? [], query.resultNoHolding ?? []]
            .flat()
            .flatMap(({ ppn }) => (ppn && /^[0-9]{8}[0-9X]$/.test(ppn) ? [ppn] : []));

        return { kind: 'ok', value: [...new Set(ppns)].slice(0, SudocCatalogue.maximumPpns) };
    }

    private async record(ppn: string, turn: SourceTurn): Promise<Step<UnimarcRecord | null>> {
        const reply = await this.http.get(
            this.recordsAddress + '/' + ppn + '.xml',
            'application/xml',
            turn,
            [404],
        );

        if (reply.kind !== 'ok') {
            return { kind: 'stopped', reason: reply };
        }

        return {
            kind: 'ok',
            value:
                reply.response.status === 404
                    ? null
                    : (UnimarcRecord.all(await reply.response.text())[0] ?? null),
        };
    }

    private static keep(
        answers: Map<string, LookupAnswer>,
        asked: readonly string[],
        record: UnimarcRecord,
    ): void {
        const answer = record.answer;

        if (answer.empty) {
            return;
        }

        for (const isbn13 of record.isbn13s) {
            if (asked.includes(isbn13) && !answers.has(isbn13)) {
                answers.set(isbn13, answer);
            }
        }
    }
}
