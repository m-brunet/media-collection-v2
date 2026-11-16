import type {
    LookupSource,
    SourceReply,
    SourceTurn,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { LookupAnswer } from '../../../../domain/value-objects/lookup-answer.value-object.js';
import { BnfSru } from './bnf-sru.adapter.js';
import type { SourceHttp } from './source-http.adapter.js';

export class BnfCatalogue implements LookupSource<LookupAnswer> {
    static readonly address = BnfSru.address;

    readonly name = 'bnf';
    readonly batchSize = 1;

    private readonly sru: BnfSru;

    constructor(http: SourceHttp, address = BnfCatalogue.address) {
        this.sru = new BnfSru(http, address);
    }

    async find(
        isbn13s: readonly string[],
        turn: SourceTurn,
    ): Promise<SourceReply<ReadonlyMap<string, LookupAnswer>>> {
        const isbn13 = isbn13s[0];

        if (isbn13 === undefined) {
            return { kind: 'none' };
        }

        const page = await this.sru.search(`bib.isbn all "${isbn13}"`, 1, turn);

        if (page.kind !== 'ok') {
            return page;
        }

        const answer = page.records[0]?.answer;

        return !answer || answer.empty
            ? { kind: 'none' }
            : { kind: 'found', value: new Map([[isbn13, answer]]) };
    }
}
