import type { BookTag } from './book-tag-reader.interface.js';
import type { RelatedChange } from '../../../../shared/application/ports/driven/audit-entry.interface.js';

export type TagChoice = { id: string } | { name: string };

// The book's tags, ordered by name, and the tags its save created.
export type TagOutcome = { tags: BookTag[]; changes: RelatedChange[] };

// Every call joins the transaction of the book operation in progress.
export interface TagAssignment {
    // Replaces the book's tags. An equivalent name (case, accents and outer spaces ignored)
    // reuses its tag; a new name creates one. An unknown tag id is refused (`tag-missing`).
    assign(bookId: string, choices: readonly TagChoice[]): Promise<TagOutcome>;
}
