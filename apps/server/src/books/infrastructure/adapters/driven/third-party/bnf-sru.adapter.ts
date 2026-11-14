import type { SourceHttp } from './source-http.adapter.js';
import { UnimarcRecord } from './unimarc-record.adapter.js';

export type SruPage =
    | { kind: 'ok'; records: UnimarcRecord[]; total: number }
    | { kind: 'limited'; retryAt: Date | null };

// The BnF general catalogue (SRU, UNIMARC records). Licence Ouverte: free reuse, source credited.
export class BnfSru {
    static readonly address = 'https://catalogue.bnf.fr/api/SRU';
    // The BnF publishes no figure for this service; a household's lookups stay far below this.
    static readonly limit = { requests: 30, seconds: 60 };

    constructor(
        private readonly http: SourceHttp,
        private readonly address = BnfSru.address,
    ) {}

    async search(query: string, maximumRecords: number, startRecord = 1): Promise<SruPage> {
        const parameters = new URLSearchParams({
            version: '1.2',
            operation: 'searchRetrieve',
            query,
            recordSchema: 'unimarcxchange',
            maximumRecords: String(maximumRecords),
            ...(startRecord > 1 ? { startRecord: String(startRecord) } : {}),
        });
        const reply = await this.http.get(
            this.address + '?' + parameters.toString(),
            'application/xml',
        );

        if (reply.kind === 'limited') {
            return reply;
        }

        const xml = await reply.response.text();

        return { kind: 'ok', records: UnimarcRecord.all(xml), total: UnimarcRecord.count(xml) };
    }
}
