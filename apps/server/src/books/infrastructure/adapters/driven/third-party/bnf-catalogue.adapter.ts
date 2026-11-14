import type {
    LookupSource,
    SourceReply,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { LookupAnswer } from '../../../../domain/value-objects/lookup-answer.value-object.js';
import { BnfSru } from './bnf-sru.adapter.js';
import type { SourceHttp } from './source-http.adapter.js';

export class BnfCatalogue implements LookupSource<LookupAnswer> {
    static readonly address = BnfSru.address;

    readonly name = 'bnf';
    // The BnF publishes no figure for this service; a household's lookups stay far below this.
    readonly limit = { requests: 30, seconds: 60 };

    private readonly sru: BnfSru;

    constructor(http: SourceHttp, address = BnfCatalogue.address) {
        this.sru = new BnfSru(http, address);
    }

    async find(isbn13: string): Promise<SourceReply<LookupAnswer>> {
        const page = await this.sru.search(`bib.isbn all "${isbn13}"`, 1);

        if (page.kind === 'limited') {
            return page;
        }

        const answer = page.records[0]?.answer;

        return !answer || answer.empty ? { kind: 'none' } : { kind: 'found', value: answer };
    }
}
