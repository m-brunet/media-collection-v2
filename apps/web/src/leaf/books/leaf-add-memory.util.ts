import type {
    BookcaseDto,
    BookCategory,
    BookDto,
} from '../../../../../packages/contracts/src/http';
import type { BookDraftValues } from '../../shared/book-form/book-draft.util';

export type RememberedChoices = Pick<
    BookDraftValues,
    'category' | 'read' | 'bookcaseId' | 'shelfId'
>;

export class LeafAddMemory {
    private static readonly categories: readonly BookCategory[] = ['books', 'manga', 'comics'];
    private static readonly prefix = 'media-collection.leaf.last-add.';

    static read(accountId: string): RememberedChoices | null {
        let stored: string | null = null;

        try {
            stored = window.localStorage.getItem(LeafAddMemory.prefix + accountId);
        } catch {
            stored = null;
        }

        return stored ? LeafAddMemory.parsed(stored) : null;
    }

    static write(accountId: string, book: BookDto): void {
        const choices: RememberedChoices = {
            category: book.category,
            read: book.personal?.read ?? false,
            bookcaseId: book.location?.bookcaseId ?? null,
            shelfId: book.location?.shelfId ?? null,
        };

        try {
            window.localStorage.setItem(LeafAddMemory.prefix + accountId, JSON.stringify(choices));
        } catch {}
    }

    static located<T extends Pick<BookDraftValues, 'bookcaseId' | 'shelfId'>>(
        values: T,
        bookcases: BookcaseDto[],
    ): T {
        if (!values.bookcaseId) {
            return values;
        }

        const bookcase = bookcases.find((candidate) => candidate.id === values.bookcaseId);
        const shelf = bookcase?.shelves.find((candidate) => candidate.id === values.shelfId);

        return shelf ? values : { ...values, bookcaseId: null, shelfId: null };
    }

    private static parsed(stored: string): RememberedChoices | null {
        let value: unknown;

        try {
            value = JSON.parse(stored);
        } catch {
            return null;
        }

        if (typeof value !== 'object' || value === null) {
            return null;
        }

        const { category, read, bookcaseId, shelfId } = value as Record<string, unknown>;
        const located =
            (bookcaseId === null && shelfId === null) ||
            (typeof bookcaseId === 'string' && typeof shelfId === 'string');

        if (
            !(LeafAddMemory.categories as readonly unknown[]).includes(category) ||
            typeof read !== 'boolean' ||
            !located
        ) {
            return null;
        }

        return {
            category: category as BookCategory,
            read,
            bookcaseId: bookcaseId as string | null,
            shelfId: shelfId as string | null,
        };
    }
}
