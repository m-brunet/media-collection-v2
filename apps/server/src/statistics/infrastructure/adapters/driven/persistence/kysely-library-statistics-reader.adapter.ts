import type { LibraryStatisticsReader } from '../../../../application/ports/driven/library-statistics-reader.interface.js';
import type {
    AuthorCount,
    BookRecord,
    BookTotals,
    CategoryCounts,
    PublisherCounts,
    ReadingSplit,
} from '../../../../application/statistics-views.js';
import type { StatisticsCategory } from '../../../../domain/services/collection-progress.service.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

type Measure = 'page_count' | 'price_cents';

export class KyselyLibraryStatisticsReader implements LibraryStatisticsReader {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async totals(category: StatisticsCategory | null): Promise<BookTotals> {
        const [row, single] = await Promise.all([
            this.owned(category)
                .select((eb) => [
                    eb.fn.countAll<number>().as('books'),
                    eb.fn.count<number>('books.page_count').as('paged'),
                    eb.fn.sum<number | null>('books.page_count').as('pages'),
                    eb.fn.count<number>('books.price_cents').as('priced'),
                    eb.fn.sum<number | null>('books.price_cents').as('cents'),
                ])
                .executeTakeFirstOrThrow(),
            this.owned(category)
                .where((eb) =>
                    eb.not(
                        eb.exists(
                            eb
                                .selectFrom('collection_books')
                                .select('collection_books.book_id')
                                .whereRef('collection_books.book_id', '=', 'books.id'),
                        ),
                    ),
                )
                .select((eb) => eb.fn.countAll<number>().as('books'))
                .executeTakeFirstOrThrow(),
        ]);

        return {
            ownedBooks: Number(row.books),
            singleBooks: Number(single.books),
            pages: { total: Number(row.pages ?? 0), known: Number(row.paged) },
            price: { totalCents: Number(row.cents ?? 0), known: Number(row.priced) },
        };
    }

    async categories(): Promise<CategoryCounts> {
        const rows = await this.owned(null)
            .select((eb) => ['books.category', eb.fn.countAll<number>().as('books')])
            .groupBy('books.category')
            .execute();
        const count = (category: StatisticsCategory) =>
            Number(rows.find((row) => row.category === category)?.books ?? 0);

        return { books: count('books'), manga: count('manga'), comics: count('comics') };
    }

    async reading(viewerId: string, category: StatisticsCategory | null): Promise<ReadingSplit> {
        const row = await this.owned(category)
            .leftJoin('reading_statuses', (join) =>
                join
                    .onRef('reading_statuses.book_id', '=', 'books.id')
                    .on('reading_statuses.user_id', '=', viewerId)
                    .on('reading_statuses.read', '=', 1),
            )
            .select((eb) => [
                eb.fn.countAll<number>().as('books'),
                eb.fn.count<number>('reading_statuses.book_id').as('read'),
            ])
            .executeTakeFirstOrThrow();
        const read = Number(row.read);

        return { read, notRead: Number(row.books) - read };
    }

    async publishers(category: StatisticsCategory | null): Promise<PublisherCounts> {
        const [rows, without] = await Promise.all([
            this.owned(category)
                .where('books.publisher', 'is not', null)
                .select((eb) => [
                    'books.publisher',
                    eb.fn.countAll<number>().as('books'),
                    eb.fn.sum<number | null>('books.page_count').as('pages'),
                ])
                .groupBy('books.publisher')
                .execute(),
            this.owned(category)
                .where('books.publisher', 'is', null)
                .select((eb) => eb.fn.countAll<number>().as('books'))
                .executeTakeFirstOrThrow(),
        ]);

        return {
            counts: rows.map((row) => ({
                name: row.publisher ?? '',
                books: Number(row.books),
                pages: Number(row.pages ?? 0),
            })),
            without: Number(without.books),
        };
    }

    async authors(category: StatisticsCategory | null): Promise<AuthorCount[]> {
        const rows = await this.owned(category)
            .innerJoin('book_authors', 'book_authors.book_id', 'books.id')
            .innerJoin('authors', 'authors.id', 'book_authors.author_id')
            .select((eb) => [
                'authors.name',
                eb.fn.count<number>('books.id').distinct().as('books'),
                eb.fn.sum<number | null>('books.page_count').as('pages'),
            ])
            .groupBy(['authors.id', 'authors.name'])
            .execute();

        return rows.map((row) => ({
            name: row.name,
            books: Number(row.books),
            pages: Number(row.pages ?? 0),
        }));
    }

    longest(category: StatisticsCategory | null): Promise<BookRecord | null> {
        return this.record(category, 'page_count');
    }

    mostExpensive(category: StatisticsCategory | null): Promise<BookRecord | null> {
        return this.record(category, 'price_cents');
    }

    private async record(
        category: StatisticsCategory | null,
        measure: Measure,
    ): Promise<BookRecord | null> {
        const column = measure === 'page_count' ? 'books.page_count' : 'books.price_cents';
        const book = await this.owned(category)
            .where(column, 'is not', null)
            .select((eb) => ['books.id', 'books.title', eb.ref(column).as('value')])
            .orderBy(column, 'desc')
            .orderBy('books.title_sort_key')
            .orderBy('books.id')
            .limit(1)
            .executeTakeFirst();

        if (!book) {
            return null;
        }

        const authors = await this.db
            .selectFrom('book_authors')
            .innerJoin('authors', 'authors.id', 'book_authors.author_id')
            .select('authors.name')
            .where('book_authors.book_id', '=', book.id)
            .orderBy('book_authors.position')
            .execute();

        return {
            id: book.id,
            title: book.title,
            authors: authors.map((author) => author.name),
            value: Number(book.value),
        };
    }

    private owned(category: StatisticsCategory | null) {
        const owned = this.db.selectFrom('books').where('books.ownership', '=', 'owned');

        return category === null ? owned : owned.where('books.category', '=', category);
    }
}
