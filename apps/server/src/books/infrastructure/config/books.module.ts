import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { AuthorRepository } from '../../application/ports/driven/author-repository.interface.js';
import type { BookCatalog } from '../../application/ports/driven/book-catalog.interface.js';
import type { BookRepository } from '../../application/ports/driven/book-repository.interface.js';
import type { CoverStorage } from '../../application/ports/driven/cover-storage.interface.js';
import type { PersonalNoteStore } from '../../application/ports/driven/personal-note-store.interface.js';
import type { ReadingStatusStore } from '../../application/ports/driven/reading-status-store.interface.js';
import { AuthorResolver } from '../../application/services/author-resolver.service.js';
import { BookDetailsBuilder } from '../../application/services/book-details-builder.service.js';
import { BookIdentityCheck } from '../../application/services/book-identity-check.service.js';
import { BookLoader } from '../../application/services/book-loader.service.js';
import { BookViewer } from '../../application/services/book-viewer.service.js';
import { CorrectAuthor } from '../../application/use-cases/correct-author.usecase.js';
import { CreateBook } from '../../application/use-cases/create-book.usecase.js';
import { DeleteBook } from '../../application/use-cases/delete-book.usecase.js';
import { DeletePersonalNote } from '../../application/use-cases/delete-personal-note.usecase.js';
import { FindAuthors } from '../../application/use-cases/find-authors.usecase.js';
import { GetBook } from '../../application/use-cases/get-book.usecase.js';
import { ListBooks } from '../../application/use-cases/list-books.usecase.js';
import { ReadCover } from '../../application/use-cases/read-cover.usecase.js';
import { RemoveCover } from '../../application/use-cases/remove-cover.usecase.js';
import { ReplaceCover } from '../../application/use-cases/replace-cover.usecase.js';
import { SavePersonalNote } from '../../application/use-cases/save-personal-note.usecase.js';
import { SetReadingStatus } from '../../application/use-cases/set-reading-status.usecase.js';
import { UpdateBook } from '../../application/use-cases/update-book.usecase.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { AuthorsController } from '../adapters/driving/web/authors.controller.js';
import { BooksController } from '../adapters/driving/web/books.controller.js';
import { CoversController } from '../adapters/driving/web/covers.controller.js';
import { PersonalReadingController } from '../adapters/driving/web/personal-reading.controller.js';

// Driven adapters and shared services the books feature is composed from.
export interface BooksDependencies {
    books: BookRepository;
    authors: AuthorRepository;
    catalog: BookCatalog;
    readings: ReadingStatusStore;
    notes: PersonalNoteStore;
    covers: CoverStorage;
    ids: IdGenerator;
    clock: Clock;
    operations: AuditedOperation;
}

const token = {
    books: 'BOOKS_REPOSITORY',
    authors: 'BOOKS_AUTHOR_REPOSITORY',
    catalog: 'BOOKS_CATALOG',
    readings: 'BOOKS_READING_STATUSES',
    notes: 'BOOKS_PERSONAL_NOTES',
    covers: 'BOOKS_COVER_STORAGE',
    ids: 'BOOKS_IDS',
    clock: 'BOOKS_CLOCK',
    operations: 'BOOKS_AUDITED_OPERATION',
    builder: 'BOOKS_DETAILS_BUILDER',
    identity: 'BOOKS_IDENTITY_CHECK',
    loader: 'BOOKS_LOADER',
    viewer: 'BOOKS_VIEWER',
} as const;

function dependencyProviders(dependencies: BooksDependencies): Provider[] {
    return (Object.keys(dependencies) as (keyof BooksDependencies)[]).map((name) => ({
        provide: token[name],
        useValue: dependencies[name],
    }));
}

const serviceProviders: Provider[] = [
    {
        provide: token.builder,
        inject: [token.authors, token.ids, token.clock],
        useFactory: (authors: AuthorRepository, ids: IdGenerator, clock: Clock) =>
            new BookDetailsBuilder(new AuthorResolver(authors, ids, clock)),
    },
    {
        provide: token.identity,
        inject: [token.books, token.authors],
        useFactory: (books: BookRepository, authors: AuthorRepository) =>
            new BookIdentityCheck(books, authors),
    },
    {
        provide: token.loader,
        inject: [token.books],
        useFactory: (books: BookRepository) => new BookLoader(books),
    },
    {
        provide: token.viewer,
        inject: [token.catalog, token.readings, token.notes],
        useFactory: (
            catalog: BookCatalog,
            readings: ReadingStatusStore,
            notes: PersonalNoteStore,
        ) => new BookViewer(catalog, readings, notes),
    },
];
const useCaseProviders: Provider[] = [
    {
        provide: 'BOOKS_CREATE',
        inject: [
            token.books,
            token.builder,
            token.identity,
            token.readings,
            token.viewer,
            token.ids,
            token.clock,
            token.operations,
        ],
        useFactory: (
            books: BookRepository,
            builder: BookDetailsBuilder,
            identity: BookIdentityCheck,
            readings: ReadingStatusStore,
            viewer: BookViewer,
            ids: IdGenerator,
            clock: Clock,
            operations: AuditedOperation,
        ) => new CreateBook(books, builder, identity, readings, viewer, ids, clock, operations),
    },
    {
        provide: 'BOOKS_UPDATE',
        inject: [
            token.books,
            token.authors,
            token.loader,
            token.builder,
            token.identity,
            token.viewer,
            token.clock,
            token.operations,
        ],
        useFactory: (
            books: BookRepository,
            authors: AuthorRepository,
            loader: BookLoader,
            builder: BookDetailsBuilder,
            identity: BookIdentityCheck,
            viewer: BookViewer,
            clock: Clock,
            operations: AuditedOperation,
        ) => new UpdateBook(books, authors, loader, builder, identity, viewer, clock, operations),
    },
    {
        provide: 'BOOKS_DELETE',
        inject: [token.books, token.authors, token.covers, token.loader, token.operations],
        useFactory: (
            books: BookRepository,
            authors: AuthorRepository,
            covers: CoverStorage,
            loader: BookLoader,
            operations: AuditedOperation,
        ) => new DeleteBook(books, authors, covers, loader, operations),
    },
    {
        provide: 'BOOKS_GET',
        inject: [token.loader, token.viewer],
        useFactory: (loader: BookLoader, viewer: BookViewer) => new GetBook(loader, viewer),
    },
    {
        provide: 'BOOKS_LIST',
        inject: [token.catalog],
        useFactory: (catalog: BookCatalog) => new ListBooks(catalog),
    },
    {
        provide: 'BOOKS_FIND_AUTHORS',
        inject: [token.authors],
        useFactory: (authors: AuthorRepository) => new FindAuthors(authors),
    },
    {
        provide: 'BOOKS_CORRECT_AUTHOR',
        inject: [token.authors, token.operations],
        useFactory: (authors: AuthorRepository, operations: AuditedOperation) =>
            new CorrectAuthor(authors, operations),
    },
    {
        provide: 'BOOKS_REPLACE_COVER',
        inject: [
            token.books,
            token.covers,
            token.loader,
            token.viewer,
            token.clock,
            token.operations,
        ],
        useFactory: (
            books: BookRepository,
            covers: CoverStorage,
            loader: BookLoader,
            viewer: BookViewer,
            clock: Clock,
            operations: AuditedOperation,
        ) => new ReplaceCover(books, covers, loader, viewer, clock, operations),
    },
    {
        provide: 'BOOKS_REMOVE_COVER',
        inject: [
            token.books,
            token.covers,
            token.loader,
            token.viewer,
            token.clock,
            token.operations,
        ],
        useFactory: (
            books: BookRepository,
            covers: CoverStorage,
            loader: BookLoader,
            viewer: BookViewer,
            clock: Clock,
            operations: AuditedOperation,
        ) => new RemoveCover(books, covers, loader, viewer, clock, operations),
    },
    {
        provide: 'BOOKS_READ_COVER',
        inject: [token.covers, token.loader],
        useFactory: (covers: CoverStorage, loader: BookLoader) => new ReadCover(covers, loader),
    },
    {
        provide: 'BOOKS_SET_READING_STATUS',
        inject: [token.readings, token.loader, token.operations],
        useFactory: (
            readings: ReadingStatusStore,
            loader: BookLoader,
            operations: AuditedOperation,
        ) => new SetReadingStatus(readings, loader, operations),
    },
    {
        provide: 'BOOKS_SAVE_NOTE',
        inject: [token.notes, token.loader, token.clock, token.operations],
        useFactory: (
            notes: PersonalNoteStore,
            loader: BookLoader,
            clock: Clock,
            operations: AuditedOperation,
        ) => new SavePersonalNote(notes, loader, clock, operations),
    },
    {
        provide: 'BOOKS_DELETE_NOTE',
        inject: [token.notes, token.loader, token.operations],
        useFactory: (notes: PersonalNoteStore, loader: BookLoader, operations: AuditedOperation) =>
            new DeletePersonalNote(notes, loader, operations),
    },
];

@Module({})
export class BooksModule {
    static register(dependencies: BooksDependencies): DynamicModule {
        return {
            module: BooksModule,
            controllers: [
                BooksController,
                AuthorsController,
                CoversController,
                PersonalReadingController,
            ],
            providers: [
                ...dependencyProviders(dependencies),
                ...serviceProviders,
                ...useCaseProviders,
            ],
        };
    }
}
