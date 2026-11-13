import type { BookCollection } from './book-collection-reader.interface.js';
import type { RelatedChange } from '../../../../shared/application/ports/driven/audit-entry.interface.js';

export type CollectionChoice = { id: string } | { name: string; distinct?: boolean };

export type MembershipRequest = {
    collection: CollectionChoice;
    volumeFrom: number;
    volumeTo: number;
    enableVolumeZero?: boolean;
};

export type MemberBook = {
    id: string;
    ownership: 'owned' | 'not-owned';
    category: 'books' | 'manga' | 'comics';
};

export type MembershipOutcome = { collection: BookCollection | null; changes: RelatedChange[] };

export interface CollectionMembership {
    assign(
        book: MemberBook,
        request: MembershipRequest | null,
        replacing: readonly string[],
    ): Promise<MembershipOutcome>;
    leave(bookId: string): Promise<RelatedChange[]>;
}
