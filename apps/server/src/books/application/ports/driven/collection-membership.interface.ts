import type { BookCollection } from './book-collection-reader.interface.js';
import type { RelatedChange } from '../../../../shared/application/ports/driven/audit-entry.interface.js';

// `distinct` confirms that a name similar to an existing collection is really another one;
// `enableVolumeZero` answers the request to include volume 0 in the collection.
export type CollectionChoice = { id: string } | { name: string; distinct?: boolean };

export type MembershipRequest = {
    collection: CollectionChoice;
    volumeFrom: number;
    volumeTo: number;
    enableVolumeZero?: boolean;
};

export type MemberBook = { id: string; ownership: 'owned' | 'not-owned' };

export type MembershipOutcome = { collection: BookCollection | null; changes: RelatedChange[] };

// Every call joins the transaction of the book operation in progress.
export interface CollectionMembership {
    // Records the book's membership, or its absence, once the book itself is saved: applies the
    // collection rules (similar names, volume 0, coverage overlap) and tidies the collections
    // involved. `replacing` lists planned books the person chose to delete for this book; they
    // must be exactly the Not Owned books its Owned coverage conflicts with. The caller deletes
    // them afterwards.
    assign(
        book: MemberBook,
        request: MembershipRequest | null,
        replacing: readonly string[],
    ): Promise<MembershipOutcome>;
    // Before the book is deleted: ends its membership and tidies its collection.
    leave(bookId: string): Promise<RelatedChange[]>;
}
