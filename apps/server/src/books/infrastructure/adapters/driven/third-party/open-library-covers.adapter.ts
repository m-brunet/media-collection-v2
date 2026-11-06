import type {
    LookupSource,
    SourceReply,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { CoverOffer } from '../../../../domain/services/cover-combination.service.js';
import type { OpenLibraryRecords } from './open-library-records.adapter.js';

// The cover Open Library holds for an edition, at its largest size. Its size is only known
// once downloaded, so it is offered without one.
export class OpenLibraryCovers implements LookupSource<CoverOffer[]> {
    readonly name = 'openlibrary';
    // Kept well below Open Library's published limits for identified clients.
    readonly limit = { requests: 20, seconds: 60 };

    constructor(private readonly records: OpenLibraryRecords) {}

    async find(isbn13: string): Promise<SourceReply<CoverOffer[]>> {
        const reply = await this.records.record(isbn13);

        if (reply.kind !== 'found') {
            return reply;
        }

        const address = reply.value.cover?.large ?? reply.value.cover?.medium;

        return address
            ? {
                  kind: 'found',
                  value: [{ address, width: null, height: null, fingerprint: null }],
              }
            : { kind: 'none' };
    }
}
