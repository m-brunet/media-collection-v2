import type { AuthorView, BookListPage, BookListQuery } from '../book-views.js';
import type { BookInput } from '../book-input.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookCatalog } from '../ports/driven/book-catalog.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import type { PersonalNoteStore } from '../ports/driven/personal-note-store.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import { AuthorResolver } from '../services/author-resolver.service.js';
import { BookDetailsBuilder } from '../services/book-details-builder.service.js';
import { BookIdentityCheck } from '../services/book-identity-check.service.js';
import { BookLoader } from '../services/book-loader.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import { Author } from '../../domain/entities/author.entity.js';
import { Book } from '../../domain/entities/book.entity.js';
import type { CoverMediaType } from '../../domain/value-objects/cover-image.value-object.js';
import {
    auditedOperation,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { CreateBook } from '../use-cases/create-book.usecase.js';

export class MemoryBooks implements BookRepository {
    readonly books = new Map<string, Book>();

    async findById(id: string): Promise<Book | null> {
        const book = this.books.get(id);

        return book ? new Book(book.snapshot) : null;
    }

    async findByIsbn(isbn13: string): Promise<Book | null> {
        const book = [...this.books.values()].find(
            (value) => value.details.isbn?.isbn13 === isbn13,
        );

        return book ? new Book(book.snapshot) : null;
    }

    async listWithoutIsbn(): Promise<Book[]> {
        return [...this.books.values()]
            .filter((book) => book.details.noIsbn)
            .map((book) => new Book(book.snapshot));
    }

    async create(book: Book): Promise<void> {
        if (book.details.isbn && (await this.findByIsbn(book.details.isbn.isbn13))) {
            throw new Failure('conflict', 'Duplicate ISBN', 'isbn-taken');
        }

        this.books.set(book.id, new Book(book.snapshot));
    }

    async save(book: Book): Promise<void> {
        this.books.set(book.id, new Book(book.snapshot));
    }

    async delete(id: string): Promise<void> {
        this.books.delete(id);
    }
}

export class MemoryAuthors implements AuthorRepository {
    readonly authors = new Map<string, Author>();

    constructor(private readonly books: MemoryBooks) {}

    async findById(id: string): Promise<Author | null> {
        const author = this.authors.get(id);

        return author ? new Author(author.snapshot) : null;
    }

    async findByIds(ids: readonly string[]): Promise<Author[]> {
        return [...this.authors.values()]
            .filter((author) => ids.includes(author.snapshot.id))
            .map((author) => new Author(author.snapshot));
    }

    async findByKey(key: string): Promise<Author | null> {
        const author = [...this.authors.values()].find((value) => value.key === key);

        return author ? new Author(author.snapshot) : null;
    }

    async list(): Promise<Author[]> {
        return [...this.authors.values()].map((author) => new Author(author.snapshot));
    }

    async create(author: Author): Promise<void> {
        if (await this.findByKey(author.key)) {
            throw new Failure('conflict', 'Equivalent author', 'author-name-taken');
        }

        this.authors.set(author.snapshot.id, new Author(author.snapshot));
    }

    async save(author: Author): Promise<void> {
        this.authors.set(author.snapshot.id, new Author(author.snapshot));
    }

    async removeUnlinked(ids: readonly string[]): Promise<void> {
        for (const id of ids) {
            const linked = [...this.books.books.values()].some((book) =>
                book.details.authorIds.includes(id),
            );

            if (!linked) {
                this.authors.delete(id);
            }
        }
    }
}

export class MemoryReadings implements ReadingStatusStore {
    readonly statuses = new Map<string, boolean>();

    async isRead(userId: string, bookId: string): Promise<boolean> {
        return this.statuses.get(userId + '/' + bookId) ?? false;
    }

    async set(userId: string, bookId: string, read: boolean): Promise<void> {
        this.statuses.set(userId + '/' + bookId, read);
    }
}

export class MemoryNotes implements PersonalNoteStore {
    readonly notes = new Map<string, { text: string; updatedAt: string }>();

    async find(
        userId: string,
        bookId: string,
    ): Promise<{ text: string; updatedAt: string } | null> {
        return this.notes.get(userId + '/' + bookId) ?? null;
    }

    async save(userId: string, bookId: string, text: string, updatedAt: string): Promise<void> {
        this.notes.set(userId + '/' + bookId, { text, updatedAt });
    }

    async delete(userId: string, bookId: string): Promise<void> {
        this.notes.delete(userId + '/' + bookId);
    }
}

export class MemoryCovers implements CoverStorage {
    readonly files = new Map<string, { bytes: Uint8Array; mediaType: CoverMediaType }>();
    private counter = 0;

    async store(bytes: Uint8Array, mediaType: CoverMediaType): Promise<string> {
        const file = 'cover-' + ++this.counter;

        this.files.set(file, { bytes, mediaType });

        return file;
    }

    async read(file: string): Promise<{ bytes: Uint8Array; mediaType: CoverMediaType } | null> {
        return this.files.get(file) ?? null;
    }

    async remove(file: string): Promise<void> {
        this.files.delete(file);
    }
}

// Minimal catalog: author names in book order; searching is covered by SQLite tests.
export class MemoryCatalog implements BookCatalog {
    constructor(
        private readonly books: MemoryBooks,
        private readonly authors: MemoryAuthors,
    ) {}

    async search(query: BookListQuery): Promise<BookListPage> {
        const items = [...this.books.books.values()].map((book) => ({
            id: book.id,
            title: book.details.title,
            authors: [],
            category: book.details.category,
            ownership: book.details.ownership,
            hasCover: book.snapshot.coverFile !== null,
            updatedAt: book.snapshot.updatedAt,
            read: query.readerId === null ? null : false,
        }));

        return { total: items.length, items };
    }

    async authorsOf(bookId: string): Promise<AuthorView[]> {
        const ids = this.books.books.get(bookId)?.details.authorIds ?? [];

        return ids.map((id) => ({ id, name: this.authors.authors.get(id)?.snapshot.name ?? '' }));
    }
}

// A library with all doubles and services wired as in production.
export function library() {
    const books = new MemoryBooks();
    const authors = new MemoryAuthors(books);
    const readings = new MemoryReadings();
    const notes = new MemoryNotes();
    const covers = new MemoryCovers();
    const trail = new MemoryAuditTrail();
    const catalog = new MemoryCatalog(books, authors);
    let counter = 0;
    const ids = { next: () => 'id-' + ++counter };
    const clock = { now: () => new Date('2026-03-01T10:00:00Z') };

    return {
        books,
        authors,
        readings,
        notes,
        covers,
        trail,
        catalog,
        ids,
        clock,
        operations: auditedOperation(trail),
        builder: new BookDetailsBuilder(new AuthorResolver(authors, ids, clock)),
        identity: new BookIdentityCheck(books, authors),
        loader: new BookLoader(books),
        viewer: new BookViewer(catalog, readings, notes),
    };
}

export function input(overrides: Partial<BookInput> = {}): BookInput {
    return {
        title: 'Piranesi',
        isbn: '9781635575637',
        noIsbn: false,
        authors: [{ name: 'Susanna Clarke' }],
        category: 'books',
        ownership: 'owned',
        publisher: null,
        publicationYear: null,
        publicationMonth: null,
        summary: null,
        pageCount: null,
        price: null,
        ...overrides,
    };
}

function actor(role: Actor['role'], id: string): Actor {
    return { id, username: id, role, mustChangePassword: false, language: null };
}

export const owner = actor('owner', 'camille');
export const otherOwner = actor('owner', 'sam');
export const guest = actor('guest', 'morgan');
export const administrator = actor('admin', 'alex');

// Saves a book through the real use case, as an Owner, for arranging later scenarios.
export async function saved(
    current: ReturnType<typeof library>,
    overrides: Partial<BookInput> = {},
    read = false,
) {
    return new CreateBook(
        current.books,
        current.builder,
        current.identity,
        current.readings,
        current.viewer,
        current.ids,
        current.clock,
        current.operations,
    ).execute(owner, input(overrides), read);
}
