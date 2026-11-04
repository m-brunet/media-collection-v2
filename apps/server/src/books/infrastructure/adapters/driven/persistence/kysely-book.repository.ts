import type { BookRepository } from '../../../../application/ports/driven/book-repository.interface.js';
import { Book } from '../../../../domain/entities/book.entity.js';
import type { BookCategory, Ownership } from '../../../../domain/entities/book.entity.js';
import { Isbn } from '../../../../domain/value-objects/isbn.value-object.js';
import { Price } from '../../../../domain/value-objects/price.value-object.js';
import { PublicationDate } from '../../../../domain/value-objects/publication-date.value-object.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';

type BookRow = DatabaseSchema['books'];

export class KyselyBookRepository implements BookRepository {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async findById(id: string): Promise<Book | null> {
        const row = await this.db
            .selectFrom('books')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async findByIsbn(isbn13: string): Promise<Book | null> {
        const row = await this.db
            .selectFrom('books')
            .selectAll()
            .where('isbn13', '=', isbn13)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async listWithoutIsbn(): Promise<Book[]> {
        const rows = await this.db
            .selectFrom('books')
            .selectAll()
            .where('no_isbn', '=', 1)
            .execute();

        return Promise.all(rows.map((row) => this.map(row)));
    }

    async create(book: Book): Promise<void> {
        try {
            await this.db.insertInto('books').values(this.row(book)).execute();
            await this.link(book);
        } catch (error) {
            this.rethrow(error);
        }
    }

    async save(book: Book): Promise<void> {
        try {
            await this.db
                .updateTable('books')
                .set(this.row(book))
                .where('id', '=', book.id)
                .execute();
            await this.db.deleteFrom('book_authors').where('book_id', '=', book.id).execute();
            await this.link(book);
        } catch (error) {
            this.rethrow(error);
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.deleteFrom('books').where('id', '=', id).execute();
    }

    private async link(book: Book): Promise<void> {
        const authorIds = book.details.authorIds;

        await this.db
            .insertInto('book_authors')
            .values(
                authorIds.map((authorId, position) => ({
                    book_id: book.id,
                    author_id: authorId,
                    position,
                })),
            )
            .execute();
    }

    private async map(row: BookRow): Promise<Book> {
        const links = await this.db
            .selectFrom('book_authors')
            .select('author_id')
            .where('book_id', '=', row.id)
            .orderBy('position')
            .execute();

        return new Book({
            id: row.id,
            details: {
                title: row.title,
                isbn: row.isbn13 ? Isbn.stored(row.isbn13, Boolean(row.isbn_converted)) : null,
                noIsbn: Boolean(row.no_isbn),
                authorIds: links.map((link) => link.author_id),
                category: row.category as BookCategory,
                ownership: row.ownership as Ownership,
                publisher: row.publisher,
                publicationDate: PublicationDate.from(row.publication_year, row.publication_month),
                summary: row.summary,
                pageCount: row.page_count,
                price: row.price_cents === null ? null : Price.fromCents(row.price_cents),
            },
            coverFile: row.cover_file,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    private row(book: Book): BookRow {
        const { id, details, coverFile, createdAt, updatedAt } = book.snapshot;

        return {
            id,
            title: details.title,
            title_key: book.titleKey,
            isbn13: details.isbn?.isbn13 ?? null,
            isbn_converted: Number(details.isbn?.convertedFromIsbn10 ?? false),
            no_isbn: Number(details.noIsbn),
            category: details.category,
            ownership: details.ownership,
            publisher: details.publisher,
            publication_year: details.publicationDate?.year ?? null,
            publication_month: details.publicationDate?.month ?? null,
            summary: details.summary,
            page_count: details.pageCount,
            price_cents: details.price?.cents ?? null,
            cover_file: coverFile,
            created_at: createdAt,
            updated_at: updatedAt,
        };
    }

    private rethrow(error: unknown): never {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
            error.message.includes('books.isbn13')
        ) {
            throw new Failure('conflict', 'A book with this ISBN is already saved.', 'isbn-taken');
        }

        throw error;
    }
}
