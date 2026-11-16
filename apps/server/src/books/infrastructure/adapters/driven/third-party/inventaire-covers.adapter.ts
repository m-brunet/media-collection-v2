import type {
    LookupSource,
    SourceReply,
    SourceTurn,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { CoverOffer } from '../../../../domain/services/cover-combination.service.js';
import type { SourceHttp } from './source-http.adapter.js';

// The part of an Inventaire "by-uris" answer the cover lookup uses. An ISBN that has an edition
// is in `redirects`, pointing at the key of that edition in `entities`; an unknown ISBN is in
// `notFound`. The picture address is relative to the Inventaire site.
interface InventaireAnswer {
    entities?: Record<string, { image?: { url?: string } }>;
    redirects?: Record<string, string>;
}

// Inventaire's entities API takes several ISBNs in one request ("uris=isbn:a|isbn:b"). It
// publishes no request limit and no maximum number of ISBNs per request. Its metadata is CC0;
// the cover pictures keep their own copyright.
export class InventaireCovers implements LookupSource<CoverOffer[]> {
    static readonly address = 'https://inventaire.io/api/entities/by-uris';

    readonly name = 'inventaire';
    readonly batchSize = 10;

    constructor(
        private readonly http: SourceHttp,
        private readonly address = InventaireCovers.address,
    ) {}

    async find(
        isbn13s: readonly string[],
        turn: SourceTurn,
    ): Promise<SourceReply<ReadonlyMap<string, CoverOffer[]>>> {
        const query = new URLSearchParams({
            uris: isbn13s.map((isbn13) => 'isbn:' + isbn13).join('|'),
        });
        const reply = await this.http.get(
            this.address + '?' + query.toString(),
            'application/json',
            turn,
        );

        if (reply.kind !== 'ok') {
            return reply;
        }

        const answer = (await reply.response.json()) as InventaireAnswer;
        const offers = new Map<string, CoverOffer[]>();

        for (const isbn13 of isbn13s) {
            const uri = 'isbn:' + isbn13;
            const picture = answer.entities?.[answer.redirects?.[uri] ?? uri]?.image?.url;

            if (picture) {
                offers.set(isbn13, [
                    {
                        address: new URL(picture, this.address).href,
                        width: null,
                        height: null,
                        fingerprint: null,
                    },
                ]);
            }
        }

        return { kind: 'found', value: offers };
    }
}
