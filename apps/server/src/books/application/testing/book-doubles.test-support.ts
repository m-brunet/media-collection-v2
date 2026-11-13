import type { AuthorView, BookListQuery, CatalogPage } from '../book-views.js';
import type { BookInput } from '../book-input.js';
import type { AuthorRepository } from '../ports/driven/author-repository.interface.js';
import type { BookCatalog } from '../ports/driven/book-catalog.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { BookLoan, BookLoanReader } from '../ports/driven/book-loan-reader.interface.js';
import type { LoanHistory } from '../ports/driven/loan-history.interface.js';
import type {
    BookCollection,
    BookCollectionReader,
} from '../ports/driven/book-collection-reader.interface.js';
import type {
    CollectionMembership,
    MembershipOutcome,
    MembershipRequest,
} from '../ports/driven/collection-membership.interface.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { LookupSource, SourceReply } from '../ports/driven/lookup-source.interface.js';
import type { LookupCoverRegistry } from '../ports/driven/lookup-cover-registry.interface.js';
import type { CoverDownloader } from '../ports/driven/cover-downloader.interface.js';
import type { CoverImage } from '../../domain/value-objects/cover-image.value-object.js';
import type { CoverTrimmer } from '../ports/driven/cover-trimmer.interface.js';
import type { PersonalNoteStore } from '../ports/driven/personal-note-store.interface.js';
import type { ReadingStatusStore } from '../ports/driven/reading-status-store.interface.js';
import type { CollectionOwnedBooks } from '../ports/driven/collection-owned-books.interface.js';
import type {
    BookLocation,
    BookLocationReader,
} from '../ports/driven/book-location-reader.interface.js';
import type { BookTag, BookTagReader } from '../ports/driven/book-tag-reader.interface.js';
import type { ShelfAssignment } from '../ports/driven/shelf-assignment.interface.js';
import type { ShelfLocator } from '../ports/driven/shelf-locator.interface.js';
import type { TagFinder } from '../ports/driven/tag-finder.interface.js';
import type {
    TagAssignment,
    TagChoice,
    TagOutcome,
} from '../ports/driven/tag-assignment.interface.js';
import { AuthorResolver } from '../services/author-resolver.service.js';
import { BookBatchPlanner } from '../services/book-batch-planner.service.js';
import { BookDetailsBuilder } from '../services/book-details-builder.service.js';
import { BookIdentityCheck } from '../services/book-identity-check.service.js';
import { BookLoader } from '../services/book-loader.service.js';
import { BookOrganisationReader } from '../services/book-organisation-reader.service.js';
import { BookOrganiser } from '../services/book-organiser.service.js';
import { BookRemoval } from '../services/book-removal.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import { GeneratedTitleSync } from '../services/generated-title-sync.service.js';
import { LentBookGuard } from '../services/lent-book-guard.service.js';
import { Author } from '../../domain/entities/author.entity.js';
import { Book } from '../../domain/entities/book.entity.js';
import type { CoverMediaType } from '../../domain/value-objects/cover-image.value-object.js';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import { BookFilter } from '../../../shared/application/book-filter.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';
import { CreateBook } from '../use-cases/create-book.usecase.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { Required } from '../../../shared/domain/required.helper.js';

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

    async readAmong(userId: string, bookIds: readonly string[]): Promise<Set<string>> {
        return new Set(bookIds.filter((bookId) => this.statuses.get(userId + '/' + bookId)));
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

export class MemoryTrimmer implements CoverTrimmer {
    readonly received: CoverImage[] = [];
    result: CoverImage | null = null;

    async trim(cover: CoverImage): Promise<CoverImage> {
        this.received.push(cover);

        return this.result ?? cover;
    }
}

export class ScriptedSource<T> implements LookupSource<T> {
    readonly asked: string[] = [];

    constructor(
        readonly name: string,
        private readonly reply: SourceReply<T> | 'fail' | 'hang',
        readonly limit = { requests: 100, seconds: 60 },
    ) {}

    async find(isbn13: string): Promise<SourceReply<T>> {
        this.asked.push(isbn13);

        if (this.reply === 'fail') {
            throw new Error('Source unreachable');
        }

        if (this.reply === 'hang') {
            return new Promise(() => undefined);
        }

        return this.reply;
    }
}

export class MemoryCoverRegistry implements LookupCoverRegistry {
    readonly addresses = new Map<string, string>();

    register(address: string): string {
        const token = 'lookup-cover-' + (this.addresses.size + 1);

        this.addresses.set(token, address);

        return token;
    }

    address(token: string): string | null {
        return this.addresses.get(token) ?? null;
    }

    forget(token: string): void {
        this.addresses.delete(token);
    }
}

export class TableDownloader implements CoverDownloader {
    readonly requested: string[] = [];

    constructor(private readonly images: Record<string, Uint8Array> = {}) {}

    async download(address: string): Promise<Uint8Array | null> {
        this.requested.push(address);

        return this.images[address] ?? null;
    }
}

export class ManualClock implements Clock {
    constructor(private current = new Date('2026-03-01T10:00:00Z')) {}

    now(): Date {
        return this.current;
    }

    advance(seconds: number): void {
        this.current = new Date(this.current.getTime() + seconds * 1000);
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

    async list(): Promise<string[]> {
        return [...this.files.keys()];
    }
}

export class MemoryLoans implements BookLoanReader, LoanHistory {
    readonly active = new Map<string, BookLoan>();
    readonly retained: { id: string; title: string; isbn: string | null }[] = [];

    lend(bookId: string, receiverName = 'Sam Taylor'): BookLoan {
        const loan = {
            id: 'loan-' + bookId,
            receiverId: 'receiver-' + NameKey.of(receiverName),
            receiverName,
            lentAt: '2026-02-01T09:00:00.000Z',
        };

        this.active.set(bookId, loan);

        return loan;
    }

    async of(bookId: string): Promise<BookLoan | null> {
        return this.active.get(bookId) ?? null;
    }

    async ofBooks(bookIds: readonly string[]): Promise<Map<string, BookLoan>> {
        return new Map(
            bookIds.flatMap((id) => {
                const loan = this.active.get(id);

                return loan ? [[id, loan] as const] : [];
            }),
        );
    }

    async retain(book: { id: string; title: string; isbn: string | null }): Promise<void> {
        this.retained.push({ ...book });
    }
}

export class MemoryCatalog implements BookCatalog {
    constructor(
        private readonly books: MemoryBooks,
        private readonly authors: MemoryAuthors,
    ) {}

    readonly queries: BookListQuery[] = [];

    async search(query: BookListQuery): Promise<CatalogPage> {
        this.queries.push(query);
        const items = [...this.books.books.values()].map((book) => ({
            id: book.id,
            title: book.details.title,
            authors: [],
            category: book.details.category,
            ownership: book.details.ownership,
            hasCover: book.snapshot.coverFile !== null,
            collection: null,
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

export class MemoryShelving implements ShelfAssignment, BookLocationReader, ShelfLocator {
    readonly known = new Map<string, BookLocation>([
        [
            'shelf-3',
            { bookcaseId: 'oak', bookcaseName: 'Oak', shelfId: 'shelf-3', shelfName: 'Shelf 3' },
        ],
        ['top', { bookcaseId: 'study', bookcaseName: 'Study', shelfId: 'top', shelfName: 'Top' }],
    ]);
    readonly placed = new Map<string, string>();

    async assign(bookId: string, shelfId: string | null): Promise<BookLocation | null> {
        if (shelfId === null) {
            this.placed.delete(bookId);

            return null;
        }

        const location = await this.locate(shelfId);

        this.placed.set(bookId, shelfId);

        return location;
    }

    async locate(shelfId: string): Promise<BookLocation> {
        const location = this.known.get(shelfId);

        if (!location) {
            throw new Failure('not_found', 'Unknown shelf', 'shelf-missing');
        }

        return location;
    }

    async of(bookId: string): Promise<BookLocation | null> {
        const shelfId = this.placed.get(bookId);

        return shelfId
            ? Required.value(
                  this.known.get(shelfId),
                  'shelf ' + shelfId + ' is known to the double',
              )
            : null;
    }
}

export class MemoryTagging implements TagAssignment, BookTagReader, TagFinder {
    readonly known = new Map<string, string>([['history', 'History']]);
    readonly tags = new Map<string, BookTag[]>();

    async assign(bookId: string, choices: readonly TagChoice[]): Promise<TagOutcome> {
        const chosen = new Map<string, BookTag>();
        const changes: TagOutcome['changes'] = [];

        for (const choice of choices) {
            const tag = this.resolve(choice, changes);

            chosen.set(tag.id, tag);
        }

        const tags = [...chosen.values()].sort((a, b) => a.name.localeCompare(b.name));

        this.tags.set(bookId, tags);

        return { tags, changes };
    }

    async of(bookId: string): Promise<BookTag[]> {
        return this.tags.get(bookId) ?? [];
    }

    async find(tagIds: readonly string[]): Promise<BookTag[]> {
        return [...new Set(tagIds)]
            .map((id) => this.resolve({ id }, []))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    private resolve(choice: TagChoice, changes: TagOutcome['changes']): BookTag {
        if ('id' in choice) {
            const name = this.known.get(choice.id);

            if (name === undefined) {
                throw new Failure('not_found', 'Unknown tag', 'tag-missing');
            }

            return { id: choice.id, name };
        }

        const name = choice.name.trim();

        Failure.ensure(
            name.length >= 1 && name.length <= 100,
            'Enter a tag name of up to 100 characters.',
            'tag-name-invalid',
        );
        const key = NameKey.of(name);
        const existing = [...this.known].find(([, known]) => NameKey.of(known) === key);

        if (existing) {
            return { id: existing[0], name: existing[1] };
        }

        const tag = { id: 'tag-' + name, name };

        this.known.set(tag.id, tag.name);
        changes.push({
            category: 'tag.created',
            subjectType: 'tag',
            subjectId: tag.id,
            before: null,
            after: { name },
        });

        return tag;
    }
}

export class MemoryMembership implements CollectionMembership, BookCollectionReader {
    readonly memberships = new Map<string, BookCollection>();
    readonly replaced: string[][] = [];
    readonly names = new Map<string, string>();
    changes: RelatedChange[] = [];

    async assign(
        book: { id: string },
        request: MembershipRequest | null,
        replacing: readonly string[],
    ): Promise<MembershipOutcome> {
        if (!request && replacing.length > 0) {
            throw new Failure('conflict', 'Nothing to replace', 'replacement-outdated');
        }

        this.replaced.push([...replacing]);

        if (!request) {
            this.memberships.delete(book.id);

            return { collection: null, changes: this.report() };
        }

        const choice = request.collection;
        const membership = {
            id: 'id' in choice ? choice.id : 'collection-' + choice.name,
            name:
                'name' in choice
                    ? (this.names.get(NameKey.of(choice.name)) ?? choice.name)
                    : (this.names.get(choice.id) ?? 'Collection'),
            volumeFrom: request.volumeFrom,
            volumeTo: request.volumeTo,
        };

        this.memberships.set(book.id, membership);

        return { collection: membership, changes: this.report() };
    }

    async leave(bookId: string): Promise<RelatedChange[]> {
        this.memberships.delete(bookId);

        return this.report();
    }

    private report(): RelatedChange[] {
        const changes = this.changes;

        this.changes = [];

        return changes;
    }

    async of(bookId: string): Promise<BookCollection | null> {
        return this.memberships.get(bookId) ?? null;
    }
}

export class MemoryCollectionBooks implements CollectionOwnedBooks {
    readonly owned = new Map<string, string[]>();

    async of(collectionId: string): Promise<string[]> {
        const books = this.owned.get(collectionId);

        if (!books) {
            throw new Failure('not_found', 'That collection does not exist.', 'collection-missing');
        }

        return [...books];
    }
}

export class BookDoubles {
    static library() {
        const books = new MemoryBooks();
        const authors = new MemoryAuthors(books);
        const readings = new MemoryReadings();
        const notes = new MemoryNotes();
        const covers = new MemoryCovers();
        const trimmer = new MemoryTrimmer();
        const trail = new MemoryAuditTrail();
        const catalog = new MemoryCatalog(books, authors);
        const collections = new MemoryMembership();
        const shelving = new MemoryShelving();
        const tagging = new MemoryTagging();
        const loans = new MemoryLoans();
        const guard = new LentBookGuard(loans);
        const organisation = new BookOrganisationReader(shelving, tagging);
        const organiser = new BookOrganiser(shelving, tagging, organisation);
        const loader = new BookLoader(books);
        let counter = 0;
        const ids = { next: () => 'id-' + ++counter };
        const clock = { now: () => new Date('2026-03-01T10:00:00Z') };
        const identity = new BookIdentityCheck(books, authors);
        const resolver = new AuthorResolver(authors, ids, clock);

        return {
            books,
            authors,
            readings,
            notes,
            covers,
            trimmer,
            trail,
            catalog,
            collections,
            shelving,
            tagging,
            loans,
            guard,
            organisation,
            organiser,
            ids,
            clock,
            operations: AuditDoubles.auditedOperation(trail),
            resolver,
            builder: new BookDetailsBuilder(resolver),
            planner: new BookBatchPlanner(
                loader,
                collections,
                authors,
                organisation,
                shelving,
                tagging,
                readings,
                guard,
                identity,
                clock,
            ),
            identity,
            titles: new GeneratedTitleSync(books, identity, clock),
            loader,
            removal: new BookRemoval(books, authors, collections, loader, guard, loans),
            viewer: new BookViewer(catalog, readings, notes, collections, organisation, loans),
        };
    }

    static input(overrides: Partial<BookInput> = {}): BookInput {
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
            collection: null,
            shelfId: null,
            tags: [],
            ...overrides,
        };
    }

    static readonly volumeIsbns = [
        '9782749310015',
        '9782749310022',
        '9782749310039',
        '9782749310046',
        '9782749310053',
        '9782749310060',
    ];

    static async volume(
        current: ReturnType<typeof BookDoubles.library>,
        volume: number,
        overrides: Partial<BookInput> = {},
    ) {
        return BookDoubles.saved(current, {
            title: '',
            isbn: Required.at(
                BookDoubles.volumeIsbns,
                volume - 1,
                'volume ' + volume + ' has a test ISBN',
            ),
            category: 'manga',
            authors: [{ name: 'Yukito Kishiro' }],
            collection: { collection: { name: 'Gunnm' }, volumeFrom: volume, volumeTo: volume },
            ...overrides,
        });
    }

    static async saved(
        current: ReturnType<typeof BookDoubles.library>,
        overrides: Partial<BookInput> = {},
        read = false,
    ) {
        return new CreateBook(
            current.books,
            current.builder,
            current.identity,
            current.titles,
            current.collections,
            current.removal,
            current.organiser,
            current.readings,
            current.covers,
            current.viewer,
            current.ids,
            current.clock,
            current.operations,
        ).execute(owner, BookDoubles.input(overrides), read);
    }
}

export const anyBook = BookFilter.of();

export const owner = TestActors.of('owner', 'camille');
export const otherOwner = TestActors.of('owner', 'sam');
export const guest = TestActors.of('guest', 'morgan');
export const administrator = TestActors.of('admin', 'alex');
