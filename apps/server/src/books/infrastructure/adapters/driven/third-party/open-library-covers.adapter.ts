import type {
    LookupSource,
    SourceReply,
    SourceTurn,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { CoverOffer } from '../../../../domain/services/cover-combination.service.js';
import { OpenLibraryRecords } from './open-library-records.adapter.js';

// Its size is only known once downloaded, so it is offered without one.
export class OpenLibraryCovers implements LookupSource<CoverOffer[]> {
    readonly name = 'openlibrary';
    readonly batchSize = OpenLibraryRecords.batchSize;

    constructor(private readonly records: OpenLibraryRecords) {}

    async find(
        isbn13s: readonly string[],
        turn: SourceTurn,
    ): Promise<SourceReply<ReadonlyMap<string, CoverOffer[]>>> {
        const reply = await this.records.records(isbn13s, turn);

        if (reply.kind !== 'found') {
            return reply;
        }

        const offers = new Map<string, CoverOffer[]>();

        for (const [isbn13, record] of reply.value) {
            const address = record.cover?.large ?? record.cover?.medium;

            if (address) {
                offers.set(isbn13, [{ address, width: null, height: null, fingerprint: null }]);
            }
        }

        return { kind: 'found', value: offers };
    }
}
