import type { BookTag } from './book-tag-reader.interface.js';
import type { RelatedChange } from '../../../../shared/application/ports/driven/audit-entry.interface.js';

export type TagChoice = { id: string } | { name: string };

export type TagOutcome = { tags: BookTag[]; changes: RelatedChange[] };

export interface TagAssignment {
    assign(bookId: string, choices: readonly TagChoice[]): Promise<TagOutcome>;
}
