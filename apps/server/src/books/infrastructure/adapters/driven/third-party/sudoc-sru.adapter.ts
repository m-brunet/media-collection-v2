import type {
    SourceRefusal,
    SourceTurn,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { SourceHttp } from './source-http.adapter.js';
import { UnimarcRecord } from './unimarc-record.adapter.js';

export type SudocSruPage = { kind: 'ok'; records: UnimarcRecord[]; total: number } | SourceRefusal;

// The SRU service of the Sudoc (version 1.1, UNIMARC records). It gives at most 50 records per
// request. Its indexes: `isb` (ISBN), `mti` (words of the title) and `edi` (publisher). A word
// with an accent finds nothing in `edi`: "Glénat" must be asked as "Glenat". Every word asked
// must be in the record.
export class SudocSru {
    static readonly address = 'https://www.sudoc.abes.fr/cbs/sru/';
    static readonly pageSize = 50;

    constructor(
        private readonly http: SourceHttp,
        private readonly address = SudocSru.address,
    ) {}

    async search(query: string, turn: SourceTurn, startRecord = 1): Promise<SudocSruPage> {
        const parameters = new URLSearchParams({
            operation: 'searchRetrieve',
            version: '1.1',
            recordSchema: 'unimarc',
            query,
            maximumRecords: String(SudocSru.pageSize),
            startRecord: String(startRecord),
        });
        const reply = await this.http.get(
            this.address + '?' + parameters.toString(),
            'application/xml',
            turn,
        );

        if (reply.kind !== 'ok') {
            return reply;
        }

        const xml = await reply.response.text();

        return { kind: 'ok', records: UnimarcRecord.all(xml), total: UnimarcRecord.count(xml) };
    }
}
