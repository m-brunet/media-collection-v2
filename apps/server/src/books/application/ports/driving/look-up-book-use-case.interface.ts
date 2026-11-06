import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CoverChoice } from '../../../domain/services/cover-combination.service.js';
import type { CombinedLookup } from '../../../domain/services/lookup-combination.service.js';
import type { SourceUnavailability } from '../../services/source-chain.service.js';

// The ISBN is already in the library: open that book instead of creating another.
export type ExistingBookLookup = {
    kind: 'existing';
    bookId: string;
};

// What the sources know about an ISBN not yet in the library, for the person to review.
// `found` false with no `unavailable` source: no source knows this ISBN. Sources listed in
// `unavailable` could not answer (rate limit or failure), which is not the same as no result.
export type LookedUpBook = {
    kind: 'looked-up';
    isbn13: string;
    found: boolean;
    fields: CombinedLookup;
    covers: CoverChoice[];
    unavailable: SourceUnavailability[];
};

export type BookLookup = ExistingBookLookup | LookedUpBook;

export interface LookUpBookUseCase {
    execute(actor: Actor, isbn: string): Promise<BookLookup>;
}
