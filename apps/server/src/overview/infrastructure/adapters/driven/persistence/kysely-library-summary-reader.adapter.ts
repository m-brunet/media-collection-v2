import type {
    BookcaseSummary,
    LibraryCounts,
    ReadingSummary,
    RecentBook,
} from '../../../../application/overview-views.js';
import type { LibrarySummaryReader } from '../../../../application/ports/driven/library-summary-reader.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Counts and lists the shared library for the Overview. It only reads the tables the books,
// collections, locations and lending features write.
export class KyselyLibrarySummaryReader implements LibrarySummaryReader {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async counts(): Promise<LibraryCounts> {
        const [ownedBooks, collections, bookcases, shelves, lentBooks] = await Promise.all([
            this.ownedBooks(),
            this.total(
                this.db
                    .selectFrom('collections')
                    .select((eb) => eb.fn.countAll<number>().as('total'))
                    .executeTakeFirstOrThrow(),
            ),
            this.total(
                this.db
                    .selectFrom('bookcases')
                    .select((eb) => eb.fn.countAll<number>().as('total'))
                    .executeTakeFirstOrThrow(),
            ),
            this.total(
                this.db
                    .selectFrom('shelves')
                    .select((eb) => eb.fn.countAll<number>().as('total'))
                    .executeTakeFirstOrThrow(),
            ),
            this.total(
                this.db
                    .selectFrom('loans')
                    .where('status', '=', 'lent')
                    .select((eb) => eb.fn.countAll<number>().as('total'))
                    .executeTakeFirstOrThrow(),
            ),
        ]);

        return { ownedBooks, collections, bookcases, shelves, lentBooks };
    }

    async recentlyAdded(limit: number, viewerId: string): Promise<RecentBook[]> {
        const books = await this.db
            .selectFrom('books')
            .leftJoin('reading_statuses', (join) =>
                join
                    .onRef('reading_statuses.book_id', '=', 'books.id')
                    .on('reading_statuses.user_id', '=', viewerId),
            )
            .select(['books.id', 'books.title', 'books.cover_file', 'reading_statuses.read'])
            .where('books.ownership', '=', 'owned')
            .orderBy('books.created_at', 'desc')
            .orderBy('books.id', 'desc')
            .limit(limit)
            .execute();

        if (books.length === 0) {
            return [];
        }

        const authors = await this.db
            .selectFrom('book_authors')
            .innerJoin('authors', 'authors.id', 'book_authors.author_id')
            .select(['book_authors.book_id', 'authors.name'])
            .where(
                'book_authors.book_id',
                'in',
                books.map((book) => book.id),
            )
            .orderBy('book_authors.position')
            .execute();

        return books.map((book) => ({
            id: book.id,
            title: book.title,
            authors: authors
                .filter((author) => author.book_id === book.id)
                .map((author) => author.name),
            hasCover: book.cover_file !== null,
            read: book.read === 1,
        }));
    }

    async reading(viewerId: string): Promise<ReadingSummary> {
        const [owned, read] = await Promise.all([
            this.ownedBooks(),
            this.total(
                this.db
                    .selectFrom('reading_statuses')
                    .innerJoin('books', 'books.id', 'reading_statuses.book_id')
                    .where('reading_statuses.user_id', '=', viewerId)
                    .where('reading_statuses.read', '=', 1)
                    .where('books.ownership', '=', 'owned')
                    .select((eb) => eb.fn.countAll<number>().as('total'))
                    .executeTakeFirstOrThrow(),
            ),
        ]);

        return { read, notRead: owned - read };
    }

    async bookcases(): Promise<BookcaseSummary[]> {
        const rows = await this.db
            .selectFrom('bookcases')
            .leftJoin('shelves', 'shelves.bookcase_id', 'bookcases.id')
            .select((eb) => [
                'bookcases.id',
                'bookcases.name',
                eb.fn.count<number>('shelves.id').as('shelf_count'),
            ])
            .groupBy(['bookcases.id', 'bookcases.name', 'bookcases.name_key'])
            .orderBy('bookcases.name_key')
            .execute();

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            shelfCount: Number(row.shelf_count),
        }));
    }

    // Saved Owned edition records: an omnibus is one book; Not Owned records are not counted.
    private ownedBooks(): Promise<number> {
        return this.total(
            this.db
                .selectFrom('books')
                .where('ownership', '=', 'owned')
                .select((eb) => eb.fn.countAll<number>().as('total'))
                .executeTakeFirstOrThrow(),
        );
    }

    private async total(row: Promise<{ total: number | string | bigint }>): Promise<number> {
        return Number((await row).total);
    }
}
