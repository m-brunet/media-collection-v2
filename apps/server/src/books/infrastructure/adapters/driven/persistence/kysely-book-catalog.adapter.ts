import type { ExpressionBuilder } from 'kysely';
import type { BookCatalog } from '../../../../application/ports/driven/book-catalog.interface.js';
import type {
    AuthorView,
    BookListQuery,
    CatalogBookItem,
    CatalogPage,
} from '../../../../application/book-views.js';
import type { BookCategory, Ownership } from '../../../../domain/entities/book.entity.js';
import { Isbn } from '../../../../domain/value-objects/isbn.value-object.js';
import type { CollectionBookSearch } from '../../../../../collections/application/ports/driven/collection-book-search.interface.js';
import type { BookFilter } from '../../../../../shared/application/book-filter.js';
import { NameKey } from '../../../../../shared/domain/name-key.helper.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Simple search: case- and accent-insensitive partial match on title, author and collection names
// (stored comparison keys), partial ISBN digits, and the ISBN-13 equivalent of a complete
// ISBN-10. Advanced filters apply to the same books. Collection listings apply the same search
// and filters: a collection matches through one of its books satisfying all of them.
export class KyselyBookCatalog implements BookCatalog, CollectionBookSearch {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async search(query: BookListQuery): Promise<CatalogPage> {
        const filter = this.matching(query.search, query.filter, query.readerId);
        const counted = await this.db
            .selectFrom('books')
            .select((eb) => eb.fn.countAll<number>().as('total'))
            .where(filter)
            .executeTakeFirstOrThrow();
        let rows = this.db
            .selectFrom('books')
            .leftJoin('collection_books', 'collection_books.book_id', 'books.id')
            .leftJoin('collections', 'collections.id', 'collection_books.collection_id')
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
                'collections.name as collection_name',
                'collection_books.volume_from',
                'collection_books.volume_to',
            ])
            .where(filter);
        const direction = query.direction;

        if (query.sort === 'added') {
            rows = rows.orderBy('books.created_at', direction);
        } else if (query.sort === 'published') {
            // Books without a publication date come last in both directions.
            rows = rows
                .orderBy((eb) => eb('books.publication_year', 'is', null))
                .orderBy('books.publication_year', direction)
                .orderBy((eb) => eb.fn.coalesce('books.publication_month', eb.val(0)), direction);
        }

        const page = await rows
            .orderBy('books.title_sort_key', query.sort === 'title' ? direction : 'asc')
            .orderBy('books.id')
            .limit(query.limit)
            .offset(query.offset)
            .execute();
        const authors = await this.authorNames(page.map((row) => row.id));

        return {
            total: Number(counted.total),
            items: page.map((row): CatalogBookItem => ({
                id: row.id,
                title: row.title,
                authors: authors.get(row.id) ?? [],
                category: row.category as BookCategory,
                ownership: row.ownership as Ownership,
                hasCover: row.cover_file !== null,
                collection:
                    row.collection_name === null
                        ? null
                        : {
                              name: row.collection_name,
                              volumeFrom: row.volume_from!,
                              volumeTo: row.volume_to!,
                          },
                updatedAt: row.updated_at,
                read: query.readerId === null ? null : Boolean(row.read),
            })),
        };
    }

    async collectionsMatching(
        search: string,
        filter: BookFilter,
        readerId: string | null,
    ): Promise<string[]> {
        const rows = await this.db
            .selectFrom('collection_books')
            .innerJoin('books', 'books.id', 'collection_books.book_id')
            .select('collection_books.collection_id')
            .distinct()
            .where(this.matching(search, filter, readerId))
            .execute();

        return rows.map((row) => row.collection_id);
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

    // One expression per book: the search text and every advanced criterion together.
    private matching(search: string, filter: BookFilter, readerId: string | null) {
        const text = this.text(search);
        const criteria = this.criteria(filter, readerId);

        return (eb: ExpressionBuilder<DatabaseSchema, 'books'>) =>
            eb.and([text(eb), ...criteria(eb)]);
    }

    private criteria(filter: BookFilter, readerId: string | null) {
        return (eb: ExpressionBuilder<DatabaseSchema, 'books'>) => [
            ...(filter.categories.length > 0
                ? [eb('books.category', 'in', filter.categories)]
                : []),
            ...(filter.ownerships.length > 0
                ? [eb('books.ownership', 'in', filter.ownerships)]
                : []),
            ...(filter.authorIds.length > 0
                ? [
                      eb.exists(
                          eb
                              .selectFrom('book_authors')
                              .select('book_authors.book_id')
                              .whereRef('book_authors.book_id', '=', 'books.id')
                              .where('book_authors.author_id', 'in', filter.authorIds),
                      ),
                  ]
                : []),
            ...this.collection(eb, filter.collections),
            ...this.location(eb, filter.locations),
            ...this.reading(eb, filter.reading, readerId),
            ...filter.tags.include.map((tagId) =>
                eb.exists(this.tagged(eb).where('book_tags.tag_id', '=', tagId)),
            ),
            ...(filter.tags.exclude.length > 0
                ? [
                      eb.not(
                          eb.exists(
                              this.tagged(eb).where('book_tags.tag_id', 'in', filter.tags.exclude),
                          ),
                      ),
                  ]
                : []),
        ];
    }

    private collection(
        eb: ExpressionBuilder<DatabaseSchema, 'books'>,
        collections: BookFilter['collections'],
    ) {
        if (collections.ids.length === 0 && !collections.none) {
            return [];
        }

        const member = eb
            .selectFrom('collection_books')
            .select('collection_books.book_id')
            .whereRef('collection_books.book_id', '=', 'books.id');

        return [
            eb.or([
                ...(collections.ids.length > 0
                    ? [
                          eb.exists(
                              member.where('collection_books.collection_id', 'in', collections.ids),
                          ),
                      ]
                    : []),
                ...(collections.none ? [eb.not(eb.exists(member))] : []),
            ]),
        ];
    }

    private location(
        eb: ExpressionBuilder<DatabaseSchema, 'books'>,
        locations: BookFilter['locations'],
    ) {
        if (
            locations.shelfIds.length === 0 &&
            locations.bookcaseIds.length === 0 &&
            !locations.none
        ) {
            return [];
        }

        const placed = eb
            .selectFrom('book_shelves')
            .innerJoin('shelves', 'shelves.id', 'book_shelves.shelf_id')
            .select('book_shelves.book_id')
            .whereRef('book_shelves.book_id', '=', 'books.id');

        return [
            eb.or([
                ...(locations.shelfIds.length > 0
                    ? [eb.exists(placed.where('book_shelves.shelf_id', 'in', locations.shelfIds))]
                    : []),
                ...(locations.bookcaseIds.length > 0
                    ? [eb.exists(placed.where('shelves.bookcase_id', 'in', locations.bookcaseIds))]
                    : []),
                ...(locations.none ? [eb.not(eb.exists(placed))] : []),
            ]),
        ];
    }

    // Read and Not read together accept any book; without a reader there is nothing to filter on.
    private reading(
        eb: ExpressionBuilder<DatabaseSchema, 'books'>,
        reading: BookFilter['reading'],
        readerId: string | null,
    ) {
        if (reading.length !== 1 || readerId === null) {
            return [];
        }

        const read = eb.exists(
            eb
                .selectFrom('reading_statuses')
                .select('reading_statuses.book_id')
                .whereRef('reading_statuses.book_id', '=', 'books.id')
                .where('reading_statuses.user_id', '=', readerId)
                .where('reading_statuses.read', '=', 1),
        );

        return [reading[0] === 'read' ? read : eb.not(read)];
    }

    private tagged(eb: ExpressionBuilder<DatabaseSchema, 'books'>) {
        return eb
            .selectFrom('book_tags')
            .select('book_tags.book_id')
            .whereRef('book_tags.book_id', '=', 'books.id');
    }

    private text(search: string) {
        const key = NameKey.of(search);
        const digits = search.replace(/[\s-]/g, '');
        const equivalent = Isbn.equivalent(search);

        return (eb: ExpressionBuilder<DatabaseSchema, 'books'>) => {
            if (key.length === 0) {
                return eb.lit(true);
            }

            return eb.or([
                eb(eb.fn<number>('instr', [eb.ref('books.title_key'), eb.val(key)]), '>', 0),
                eb.exists(
                    eb
                        .selectFrom('book_authors')
                        .innerJoin('authors', 'authors.id', 'book_authors.author_id')
                        .select('book_authors.book_id')
                        .whereRef('book_authors.book_id', '=', 'books.id')
                        .where((author) =>
                            author(
                                author.fn<number>('instr', [
                                    author.ref('authors.name_key'),
                                    author.val(key),
                                ]),
                                '>',
                                0,
                            ),
                        ),
                ),
                eb.exists(
                    eb
                        .selectFrom('collection_books')
                        .innerJoin(
                            'collections',
                            'collections.id',
                            'collection_books.collection_id',
                        )
                        .select('collection_books.book_id')
                        .whereRef('collection_books.book_id', '=', 'books.id')
                        .where((collection) =>
                            collection(
                                collection.fn<number>('instr', [
                                    collection.ref('collections.name_key'),
                                    collection.val(key),
                                ]),
                                '>',
                                0,
                            ),
                        ),
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
