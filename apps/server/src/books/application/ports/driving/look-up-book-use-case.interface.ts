import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CombinedLookup } from '../../../domain/services/lookup-combination.service.js';
import type { AuthorSpelling } from '../../services/author-matcher.service.js';
import type { SourceUnavailability } from '../../services/source-chain.service.js';

export type ExistingBookLookup = {
    kind: 'existing';
    bookId: string;
};

export type LookupCoverView = {
    token: string;
    width: number | null;
    height: number | null;
    sources: string[];
};

export type LookedUpBook = {
    kind: 'looked-up';
    isbn13: string;
    found: boolean;
    fields: CombinedLookup;
    authorSpellings: AuthorSpelling[];
    covers: LookupCoverView[];
    unavailable: SourceUnavailability[];
};

export type BookLookup = ExistingBookLookup | LookedUpBook;

export interface LookUpBookUseCase {
    execute(actor: Actor, isbn: string): Promise<BookLookup>;
}
