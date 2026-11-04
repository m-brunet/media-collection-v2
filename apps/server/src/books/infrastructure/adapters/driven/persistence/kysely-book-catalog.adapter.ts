import { sql } from 'kysely';
import type { ExpressionBuilder } from 'kysely';
import type { BookCatalog } from '../../../../application/ports/driven/book-catalog.interface.js';
import type {
    AuthorView,
    BookListItem,
    BookListPage,
    BookListQuery,
} from '../../../../application/book-views.js';
import type { BookCategory, Ownership } from '../../../../domain/entities/book.entity.js';
import { Isbn } from '../../../../domain/value-objects/isbn.value-object.js';
import { NameKey } from '../../../../../shared/domain/name-key.helper.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Simple search: case- and accent-insensitive partial match on title and author names (stored
// comparison keys), partial ISBN digits, and the ISBN-13 equivalent of a complete ISBN-10.
export class KyselyBookCatalog implements BookCatalog {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async search(query: BookListQuery): Promise<BookListPage> {
        const filter = this.filter(query.search);
        const counted = await this.db
            .selectFrom('books')
            .select((eb) => eb.fn.countAll<number>().as('total'))
            .where(filter)
            .executeTakeFirstOrThrow();
        let rows = this.db
            .selectFrom('books')
            .leftJoin('reading_statuses', (join) =>
                join
                    .onRef('reading_statuses.book_id', '=', 'books.id')
                    .on('reading_statuses.user_id', '=', query.readerId ?? ''),
            )
            .select([
                'books.id',
                'books.title',
                'books.category',
                'books.ownership',
                'books.cover_file',
                'books.updated_at',
                'reading_statuses.read',
            ])
            .where(filter);
        const direction = query.direction;

        if (query.sort === 'added') {
            rows = rows.orderBy('books.created_at', direction);
        } else if (query.sort === 'published') {
            // Books without a publication date come last in both directions.
            rows = rows
                .orderBy(sql`books.publication_year is null`)
                .orderBy('books.publication_year', direction)
                .orderBy(sql`coalesce(books.publication_month, 0)`, direction);
        }

        const page = await rows
            .orderBy('books.title_key', query.sort === 'title' ? direction : 'asc')
            .orderBy('books.id')
            .limit(query.limit)
            .offset(query.offset)
            .execute();
        const authors = await this.authorNames(page.map((row) => row.id));

        return {
            total: Number(counted.total),
            items: page.map((row): BookListItem => ({
                id: row.id,
                title: row.title,
                authors: authors.get(row.id) ?? [],
                category: row.category as BookCategory,
                ownership: row.ownership as Ownership,
                hasCover: row.cover_file !== null,
                updatedAt: row.updated_at,
                read: query.readerId === null ? null : Boolean(row.read),
            })),
        };
    }

    async authorsOf(bookId: string): Promise<AuthorView[]> {
        return this.db
            .selectFrom('book_authors')
            .innerJoin('authors', 'authors.id', 'book_authors.author_id')
            .select(['authors.id', 'authors.name'])
            .where('book_authors.book_id', '=', bookId)
            .orderBy('book_authors.position')
            .execute();
    }

    private filter(search: string) {
        const key = NameKey.of(search);
        const digits = search.replace(/[\s-]/g, '');
        const equivalent = Isbn.equivalent(search);
        const like = '%' + key.replace(/[\\%_]/g, (character) => '\\' + character) + '%';

        return (eb: ExpressionBuilder<DatabaseSchema, 'books'>) => {
            if (key.length === 0) {
                return eb.lit(true);
            }

            return eb.or([
                sql<boolean>`books.title_key like ${like} escape '\\'`,
                eb.exists(
                    eb
                        .selectFrom('book_authors')
                        .innerJoin('authors', 'authors.id', 'book_authors.author_id')
                        .select('book_authors.book_id')
                        .whereRef('book_authors.book_id', '=', 'books.id')
                        .where(sql<boolean>`authors.name_key like ${like} escape '\\'`),
                ),
                ...(/^\d{3,13}$/.test(digits)
                    ? [eb('books.isbn13', 'like', '%' + digits + '%')]
                    : []),
                ...(equivalent ? [eb('books.isbn13', '=', equivalent)] : []),
            ]);
        };
    }

    private async authorNames(bookIds: string[]): Promise<Map<string, string[]>> {
        const names = new Map<string, string[]>();

        if (bookIds.length === 0) {
            return names;
        }

        const rows = await this.db
            .selectFrom('book_authors')
            .innerJoin('authors', 'authors.id', 'book_authors.author_id')
            .select(['book_authors.book_id', 'authors.name'])
            .where('book_authors.book_id', 'in', bookIds)
            .orderBy('book_authors.position')
            .execute();

        for (const row of rows) {
            names.set(row.book_id, [...(names.get(row.book_id) ?? []), row.name]);
        }

        return names;
    }
}
