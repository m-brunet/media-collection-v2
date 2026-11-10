import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import { Author } from '../../domain/entities/author.entity.js';
import { Book } from '../../domain/entities/book.entity.js';
import type { BookCategory, BookDetails, Ownership } from '../../domain/entities/book.entity.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import { PublicationDate } from '../../domain/value-objects/publication-date.value-object.js';
import { EntityBuilder } from '../../../shared/application/testing/entity-builder.test-support.js';
import { TestIds } from '../../../shared/application/testing/test-ids.test-support.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export type BookPorts = { books: BookRepository; authors: AuthorRepository };

type BuilderAuthor = { id: string; name: string };

// Saving creates its authors, reusing a saved author with an equivalent name. Collection
// membership, location and tags belong to their features and are not set here.
export class BookBuilder extends EntityBuilder<Book, BookPorts> {
    private id: string | null = null;
    private title: string | null = null;
    private titleGenerated = false;
    private isbn: string | null = null;
    private authors: BuilderAuthor[] | null = null;
    private category: BookCategory = 'books';
    private ownership: Ownership = 'owned';
    private publisher: string | null = null;
    private publicationYear: number | null = null;
    private pageCount: number | null = null;
    private createdAt = '2026-01-01T00:00:00.000Z';

    withId(id: string): this {
        this.id = id;

        return this;
    }

    withTitle(title: string): this {
        this.title = title;
        this.titleGenerated = false;

        return this;
    }

    // An ISBN-10 or ISBN-13, as typed.
    withIsbn(isbn: string): this {
        this.isbn = isbn;

        return this;
    }

    withAuthors(...names: string[]): this {
        this.authors = names.map((name) => ({ id: TestIds.next(), name }));

        return this;
    }

    withCategory(category: BookCategory): this {
        this.category = category;

        return this;
    }

    withPublisher(publisher: string): this {
        this.publisher = publisher;

        return this;
    }

    withPublicationYear(year: number): this {
        this.publicationYear = year;

        return this;
    }

    withPageCount(pageCount: number): this {
        this.pageCount = pageCount;

        return this;
    }

    withCreatedAt(createdAt: string): this {
        this.createdAt = createdAt;

        return this;
    }

    asPlanned(): this {
        this.ownership = 'not-owned';

        return this;
    }

    asGenerated(title: string, category: 'manga' | 'comics' = 'manga'): this {
        this.title = title;
        this.titleGenerated = true;
        this.category = category;

        return this;
    }

    build(): Book {
        return new Book({
            id: this.id ?? TestIds.next(),
            details: this.details(this.resolvedAuthors().map((author) => author.id)),
            coverFile: null,
            createdAt: this.createdAt,
            updatedAt: this.createdAt,
        });
    }

    async buildAndSave(ports: BookPorts): Promise<Book> {
        const authorIds: string[] = [];

        for (const author of this.resolvedAuthors()) {
            authorIds.push(await this.savedAuthor(ports.authors, author));
        }

        const book = new Book({
            id: this.id ?? TestIds.next(),
            details: this.details(authorIds),
            coverFile: null,
            createdAt: this.createdAt,
            updatedAt: this.createdAt,
        });

        await ports.books.create(book);

        return book;
    }

    private resolvedAuthors(): BuilderAuthor[] {
        this.authors ??= [{ id: TestIds.next(), name: 'Author ' + TestIds.sequence() }];

        return this.authors;
    }

    private async savedAuthor(authors: AuthorRepository, author: BuilderAuthor): Promise<string> {
        const existing = await authors.findByKey(NameKey.of(author.name));

        if (existing) {
            return existing.snapshot.id;
        }

        await authors.create(
            new Author({ id: author.id, name: author.name, createdAt: this.createdAt }),
        );

        return author.id;
    }

    private details(authorIds: string[]): BookDetails {
        this.title ??= 'Book ' + TestIds.sequence();

        return {
            title: this.title,
            titleGenerated: this.titleGenerated,
            isbn: this.isbn ? Isbn.parse(this.isbn) : null,
            noIsbn: this.isbn === null,
            authorIds,
            category: this.category,
            ownership: this.ownership,
            publisher: this.publisher,
            publicationDate: PublicationDate.from(this.publicationYear, null),
            summary: null,
            pageCount: this.pageCount,
            price: null,
        };
    }
}
