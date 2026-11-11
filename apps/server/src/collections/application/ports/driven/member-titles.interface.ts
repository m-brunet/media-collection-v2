import type { RelatedChange } from '../../../../shared/application/ports/driven/audit-entry.interface.js';

export type TitledMember = { bookId: string; volumeFrom: number; volumeTo: number };

export interface MemberTitles {
    regenerate(collectionName: string, members: readonly TitledMember[]): Promise<RelatedChange[]>;
    keep(bookIds: readonly string[]): Promise<RelatedChange[]>;
}
