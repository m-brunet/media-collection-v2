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
    readonly limit = BnfSru.limit;

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
