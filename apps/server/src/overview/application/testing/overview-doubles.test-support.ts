import type { Actor } from '../../../shared/domain/actor.helper.js';
import type {
    BookcaseSummary,
    LibraryCounts,
    ReadingSummary,
    RecentBook,
} from '../overview-views.js';
import type { LibrarySummaryReader } from '../ports/driven/library-summary-reader.interface.js';

function actor(role: Actor['role'], id: string, mustChangePassword = false): Actor {
    return { id, username: id, role, mustChangePassword, language: null };
}

export const owner = actor('owner', 'camille');
export const otherOwner = actor('owner', 'sam');
export const guest = actor('guest', 'morgan');
export const temporaryOwner = actor('owner', 'kim', true);

type StoredBook = Omit<RecentBook, 'read'> & { addedAt: string; readBy: string[] };

// Owned books held in memory, with the reader's contract: newest record first, each viewer's
// own reading status.
export class InMemoryLibrarySummary implements LibrarySummaryReader {
    readonly books: StoredBook[] = [];
    counted: LibraryCounts = {
        ownedBooks: 0,
        collections: 0,
        bookcases: 0,
        shelves: 0,
        lentBooks: 0,
    };
    shelvedIn: BookcaseSummary[] = [];

    add(title: string, addedAt: string, readBy: string[] = []): this {
        this.books.push({
            id: 'book-' + title.toLowerCase(),
            title,
            authors: ['Frank Herbert'],
            hasCover: false,
            addedAt,
            readBy,
        });

        return this;
    }

    async counts(): Promise<LibraryCounts> {
        return { ...this.counted, ownedBooks: this.books.length };
    }

    async recentlyAdded(limit: number, viewerId: string): Promise<RecentBook[]> {
        return [...this.books]
            .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
            .slice(0, limit)
            .map(({ addedAt: _addedAt, readBy, ...book }) => ({
                ...book,
                read: readBy.includes(viewerId),
            }));
    }

    async reading(viewerId: string): Promise<ReadingSummary> {
        const read = this.books.filter((book) => book.readBy.includes(viewerId)).length;

        return { read, notRead: this.books.length - read };
    }

    async bookcases(): Promise<BookcaseSummary[]> {
        return this.shelvedIn;
    }
}
