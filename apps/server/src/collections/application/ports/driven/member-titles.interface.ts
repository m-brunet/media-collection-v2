import type { RelatedChange } from '../../../../shared/application/ports/driven/audit-entry.interface.js';

// A member book whose generated title follows its collection.
export type TitledMember = { bookId: string; volumeFrom: number; volumeTo: number };

// The titles of member books, owned by the books feature. Each call joins the transaction of the
// collection operation in progress and returns the book changes it made, for its audit.
export interface MemberTitles {
    // After a rename: generated titles take the new name; supplied titles are untouched.
    regenerate(collectionName: string, members: readonly TitledMember[]): Promise<RelatedChange[]>;
    // Before the whole collection is deleted: generated titles are kept as supplied titles.
    keep(bookIds: readonly string[]): Promise<RelatedChange[]>;
}
