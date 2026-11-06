import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { AuthorRepository } from '../../application/ports/driven/author-repository.interface.js';
import type { BookCatalog } from '../../application/ports/driven/book-catalog.interface.js';
import type { BookCollectionReader } from '../../application/ports/driven/book-collection-reader.interface.js';
import type { BookRepository } from '../../application/ports/driven/book-repository.interface.js';
import type { CollectionMembership } from '../../application/ports/driven/collection-membership.interface.js';
import type { CoverStorage } from '../../application/ports/driven/cover-storage.interface.js';
import type { CoverTrimmer } from '../../application/ports/driven/cover-trimmer.interface.js';
import type { PersonalNoteStore } from '../../application/ports/driven/personal-note-store.interface.js';
import type { ReadingStatusStore } from '../../application/ports/driven/reading-status-store.interface.js';
import type { BookLocationReader } from '../../application/ports/driven/book-location-reader.interface.js';
import type { BookTagReader } from '../../application/ports/driven/book-tag-reader.interface.js';
import type { BookLoanReader } from '../../application/ports/driven/book-loan-reader.interface.js';
import type { LoanHistory } from '../../application/ports/driven/loan-history.interface.js';
import type { ShelfAssignment } from '../../application/ports/driven/shelf-assignment.interface.js';
import type { TagAssignment } from '../../application/ports/driven/tag-assignment.interface.js';
import { AuthorResolver } from '../../application/services/author-resolver.service.js';
import { BookDetailsBuilder } from '../../application/services/book-details-builder.service.js';
import { BookIdentityCheck } from '../../application/services/book-identity-check.service.js';
import { BookLoader } from '../../application/services/book-loader.service.js';
import { BookOrganisationReader } from '../../application/services/book-organisation-reader.service.js';
import { BookOrganiser } from '../../application/services/book-organiser.service.js';
import { BookRemoval } from '../../application/services/book-removal.service.js';
import { BookViewer } from '../../application/services/book-viewer.service.js';
import { CollectionMemberTitles } from '../../application/services/collection-member-titles.service.js';
import { GeneratedTitleSync } from '../../application/services/generated-title-sync.service.js';
import type { MemberTitles } from '../../../collections/application/ports/driven/member-titles.interface.js';
import { LentBookGuard } from '../../application/services/lent-book-guard.service.js';
import { CorrectAuthor } from '../../application/use-cases/correct-author.usecase.js';
import { CreateBook } from '../../application/use-cases/create-book.usecase.js';
import { ImportBook } from '../../application/use-cases/import-book.usecase.js';
import { DeleteBook } from '../../application/use-cases/delete-book.usecase.js';
import { DeletePersonalNote } from '../../application/use-cases/delete-personal-note.usecase.js';
import { NameAuthors } from '../../application/use-cases/name-authors.usecase.js';
import { FindAuthors } from '../../application/use-cases/find-authors.usecase.js';
import { GetBook } from '../../application/use-cases/get-book.usecase.js';
import { ListBooks } from '../../application/use-cases/list-books.usecase.js';
import { OrganiseBook } from '../../application/use-cases/organise-book.usecase.js';
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
import type { LookupSource } from '../../application/ports/driven/lookup-source.interface.js';
import type { CoverDownloader } from '../../application/ports/driven/cover-downloader.interface.js';
import type { LookupCoverRegistry } from '../../application/ports/driven/lookup-cover-registry.interface.js';
import { SourceBudget } from '../../application/services/source-budget.service.js';
import { SourceLink } from '../../application/services/source-chain.service.js';
import { LookUpBook } from '../../application/use-cases/look-up-book.usecase.js';
import { ReadLookupCover } from '../../application/use-cases/read-lookup-cover.usecase.js';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import type { LookupAnswer } from '../../domain/value-objects/lookup-answer.value-object.js';
import { MemoryLookupCoverRegistry } from '../adapters/driven/memory/memory-lookup-cover-registry.adapter.js';
import { BnfCatalogue } from '../adapters/driven/third-party/bnf-catalogue.adapter.js';
import { HttpCoverDownloader } from '../adapters/driven/third-party/http-cover-downloader.adapter.js';
import { OpenLibraryCovers } from '../adapters/driven/third-party/open-library-covers.adapter.js';
import { OpenLibraryInformation } from '../adapters/driven/third-party/open-library-information.adapter.js';
import { OpenLibraryRecords } from '../adapters/driven/third-party/open-library-records.adapter.js';
import { SourceHttp } from '../adapters/driven/third-party/source-http.adapter.js';
import { LookupsController } from '../adapters/driving/web/lookups.controller.js';
import { SharpCoverTrimmer } from '../adapters/driven/image/sharp-cover-trimmer.adapter.js';

// The outside sources Find book asks, and how their covers are downloaded.
export interface BookLookupSources {
    information: LookupSource<LookupAnswer>[];
    covers: LookupSource<CoverOffer[]>[];
    downloader: CoverDownloader;
}

// Driven adapters and shared services the books feature is composed from.
export interface BooksDependencies {
    books: BookRepository;
    authors: AuthorRepository;
    catalog: BookCatalog;
    readings: ReadingStatusStore;
    notes: PersonalNoteStore;
    covers: CoverStorage;
    // Owned by the collections feature, composed by the application root.
    collections: CollectionMembership;
    collectionReader: BookCollectionReader;
    // Owned by the locations and tags features.
    shelves: ShelfAssignment;
    locationReader: BookLocationReader;
    tags: TagAssignment;
    tagReader: BookTagReader;
    // Owned by the lending feature.
    loans: BookLoanReader;
    loanHistory: LoanHistory;
    // Find book's outside sources, each list in order of preference (see `BooksModule.lookupSources`).
    lookup: BookLookupSources;
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
    collections: 'BOOKS_COLLECTION_MEMBERSHIP',
    collectionReader: 'BOOKS_COLLECTION_READER',
    shelves: 'BOOKS_SHELF_ASSIGNMENT',
    locationReader: 'BOOKS_LOCATION_READER',
    tags: 'BOOKS_TAG_ASSIGNMENT',
    tagReader: 'BOOKS_TAG_READER',
    loans: 'BOOKS_LOAN_READER',
    loanHistory: 'BOOKS_LOAN_HISTORY',
    ids: 'BOOKS_IDS',
    clock: 'BOOKS_CLOCK',
    operations: 'BOOKS_AUDITED_OPERATION',
    builder: 'BOOKS_DETAILS_BUILDER',
    identity: 'BOOKS_IDENTITY_CHECK',
    loader: 'BOOKS_LOADER',
    viewer: 'BOOKS_VIEWER',
    removal: 'BOOKS_REMOVAL',
    organiser: 'BOOKS_ORGANISER',
    organisation: 'BOOKS_ORGANISATION_READER',
    guard: 'BOOKS_LENT_BOOK_GUARD',
    titles: 'BOOKS_GENERATED_TITLE_SYNC',
    trimmer: 'BOOKS_COVER_TRIMMER',
    lookup: 'BOOKS_LOOKUP_SOURCES',
    lookupCovers: 'BOOKS_LOOKUP_COVERS',
    lookupChains: 'BOOKS_LOOKUP_CHAINS',
} as const;

// One chain per kind of source, built once so each source's rate budget lasts across lookups.
function chain<T>(sources: LookupSource<T>[], clock: Clock): SourceLink<T> | null {
    return sources.reduceRight<SourceLink<T> | null>(
        (next, source) =>
            new SourceLink(source, new SourceBudget(source.limit, clock), clock, next),
        null,
    );
}

function dependencyProviders(dependencies: BooksDependencies): Provider[] {
    return (Object.keys(dependencies) as (keyof BooksDependencies)[]).map((name) => ({
        provide: token[name],
        useValue: dependencies[name],
    }));
}

const serviceProviders: Provider[] = [
    {
        provide: token.lookupCovers,
        inject: [token.clock],
        useFactory: (clock: Clock): LookupCoverRegistry => new MemoryLookupCoverRegistry(clock),
    },
    {
        provide: token.lookupChains,
        inject: [token.lookup, token.clock],
        useFactory: (lookup: BookLookupSources, clock: Clock) => ({
            information: chain(lookup.information, clock),
            covers: chain(lookup.covers, clock),
        }),
    },
    {
        provide: token.trimmer,
        useFactory: (): CoverTrimmer => new SharpCoverTrimmer(),
    },
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
        provide: token.organisation,
        inject: [token.locationReader, token.tagReader],
        useFactory: (locations: BookLocationReader, tags: BookTagReader) =>
            new BookOrganisationReader(locations, tags),
    },
    {
        provide: token.organiser,
        inject: [token.shelves, token.tags, token.organisation],
        useFactory: (
            shelves: ShelfAssignment,
            tags: TagAssignment,
            organisation: BookOrganisationReader,
        ) => new BookOrganiser(shelves, tags, organisation),
    },
    {
        provide: token.titles,
        inject: [token.books, token.identity, token.clock],
        useFactory: (books: BookRepository, identity: BookIdentityCheck, clock: Clock) =>
            new GeneratedTitleSync(books, identity, clock),
    },
    {
        provide: token.guard,
        inject: [token.loans],
        useFactory: (loans: BookLoanReader) => new LentBookGuard(loans),
    },
    {
        provide: token.viewer,
        inject: [
            token.catalog,
            token.readings,
            token.notes,
            token.collectionReader,
            token.organisation,
            token.loans,
        ],
        useFactory: (
            catalog: BookCatalog,
            readings: ReadingStatusStore,
            notes: PersonalNoteStore,
            collections: BookCollectionReader,
            organisation: BookOrganisationReader,
            loans: BookLoanReader,
        ) => new BookViewer(catalog, readings, notes, collections, organisation, loans),
    },
    {
        provide: token.removal,
        inject: [
            token.books,
            token.authors,
            token.collections,
            token.loader,
            token.guard,
            token.loanHistory,
        ],
        useFactory: (
            books: BookRepository,
            authors: AuthorRepository,
            collections: CollectionMembership,
            loader: BookLoader,
            guard: LentBookGuard,
            history: LoanHistory,
        ) => new BookRemoval(books, authors, collections, loader, guard, history),
    },
];
const useCaseProviders: Provider[] = [
    {
        provide: 'BOOKS_LOOK_UP',
        inject: [token.books, token.lookupChains, token.lookupCovers],
        useFactory: (
            books: BookRepository,
            chains: {
                information: SourceLink<LookupAnswer> | null;
                covers: SourceLink<CoverOffer[]> | null;
            },
            registry: LookupCoverRegistry,
        ) => new LookUpBook(books, chains.information, chains.covers, registry),
    },
    {
        provide: 'BOOKS_READ_LOOKUP_COVER',
        inject: [token.lookupCovers, token.lookup],
        useFactory: (registry: LookupCoverRegistry, lookup: BookLookupSources) =>
            new ReadLookupCover(registry, lookup.downloader),
    },
    {
        provide: 'BOOKS_CREATE',
        inject: [
            token.books,
            token.builder,
            token.identity,
            token.titles,
            token.collections,
            token.removal,
            token.organiser,
            token.readings,
            token.covers,
            token.viewer,
            token.ids,
            token.clock,
            token.operations,
        ],
        useFactory: (
            books: BookRepository,
            builder: BookDetailsBuilder,
            identity: BookIdentityCheck,
            titles: GeneratedTitleSync,
            collections: CollectionMembership,
            removal: BookRemoval,
            organiser: BookOrganiser,
            readings: ReadingStatusStore,
            covers: CoverStorage,
            viewer: BookViewer,
            ids: IdGenerator,
            clock: Clock,
            operations: AuditedOperation,
        ) =>
            new CreateBook(
                books,
                builder,
                identity,
                titles,
                collections,
                removal,
                organiser,
                readings,
                covers,
                viewer,
                ids,
                clock,
                operations,
            ),
    },
    {
        provide: 'BOOKS_UPDATE',
        inject: [
            token.books,
            token.authors,
            token.collections,
            token.collectionReader,
            token.removal,
            token.organiser,
            token.covers,
            token.loader,
            token.builder,
            token.identity,
            token.titles,
            token.guard,
            token.viewer,
            token.clock,
            token.operations,
        ],
        useFactory: (
            books: BookRepository,
            authors: AuthorRepository,
            collections: CollectionMembership,
            memberships: BookCollectionReader,
            removal: BookRemoval,
            organiser: BookOrganiser,
            covers: CoverStorage,
            loader: BookLoader,
            builder: BookDetailsBuilder,
            identity: BookIdentityCheck,
            titles: GeneratedTitleSync,
            guard: LentBookGuard,
            viewer: BookViewer,
            clock: Clock,
            operations: AuditedOperation,
        ) =>
            new UpdateBook(
                books,
                authors,
                collections,
                memberships,
                removal,
                organiser,
                covers,
                loader,
                builder,
                identity,
                titles,
                guard,
                viewer,
                clock,
                operations,
            ),
    },
    {
        provide: 'BOOKS_DELETE',
        inject: [
            token.removal,
            token.collectionReader,
            token.organisation,
            token.covers,
            token.operations,
        ],
        useFactory: (
            removal: BookRemoval,
            collections: BookCollectionReader,
            organisation: BookOrganisationReader,
            covers: CoverStorage,
            operations: AuditedOperation,
        ) => new DeleteBook(removal, collections, organisation, covers, operations),
    },
    {
        provide: 'BOOKS_ORGANISE',
        inject: [token.loader, token.organiser, token.viewer, token.operations],
        useFactory: (
            loader: BookLoader,
            organiser: BookOrganiser,
            viewer: BookViewer,
            operations: AuditedOperation,
        ) => new OrganiseBook(loader, organiser, viewer, operations),
    },
    {
        provide: 'BOOKS_GET',
        inject: [token.loader, token.viewer],
        useFactory: (loader: BookLoader, viewer: BookViewer) => new GetBook(loader, viewer),
    },
    {
        provide: 'BOOKS_LIST',
        inject: [token.catalog, token.loans],
        useFactory: (catalog: BookCatalog, loans: BookLoanReader) => new ListBooks(catalog, loans),
    },
    {
        provide: 'BOOKS_FIND_AUTHORS',
        inject: [token.authors],
        useFactory: (authors: AuthorRepository) => new FindAuthors(authors),
    },
    {
        provide: 'BOOKS_NAME_AUTHORS',
        inject: [token.authors],
        useFactory: (authors: AuthorRepository) => new NameAuthors(authors),
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
            token.trimmer,
            token.loader,
            token.viewer,
            token.clock,
            token.operations,
        ],
        useFactory: (
            books: BookRepository,
            covers: CoverStorage,
            trimmer: CoverTrimmer,
            loader: BookLoader,
            viewer: BookViewer,
            clock: Clock,
            operations: AuditedOperation,
        ) => new ReplaceCover(books, covers, trimmer, loader, viewer, clock, operations),
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
// No HTTP endpoint: registered for the development V1 import only.
const developmentProviders: Provider[] = [
    {
        provide: 'BOOKS_IMPORT',
        inject: [
            token.books,
            token.builder,
            token.identity,
            token.titles,
            token.collections,
            token.readings,
            token.covers,
            token.trimmer,
            token.ids,
            token.clock,
            token.operations,
        ],
        useFactory: (
            books: BookRepository,
            builder: BookDetailsBuilder,
            identity: BookIdentityCheck,
            titles: GeneratedTitleSync,
            collections: CollectionMembership,
            readings: ReadingStatusStore,
            covers: CoverStorage,
            trimmer: CoverTrimmer,
            ids: IdGenerator,
            clock: Clock,
            operations: AuditedOperation,
        ) =>
            new ImportBook(
                books,
                builder,
                identity,
                titles,
                collections,
                readings,
                covers,
                trimmer,
                ids,
                clock,
                operations,
            ),
    },
];

@Module({})
export class BooksModule {
    // `developmentImport` adds `BOOKS_IMPORT`, for the development data commands only.
    static register(
        dependencies: BooksDependencies,
        options: { developmentImport?: boolean } = {},
    ): DynamicModule {
        return {
            module: BooksModule,
            controllers: [
                BooksController,
                AuthorsController,
                CoversController,
                PersonalReadingController,
                LookupsController,
            ],
            providers: [
                ...dependencyProviders(dependencies),
                ...serviceProviders,
                ...useCaseProviders,
                ...(options.developmentImport ? developmentProviders : []),
            ],
        };
    }

    // The real outside sources, in the order of preference decided in Task 6: BnF then Open Library
    // for book information, Open Library for covers. Addresses can be replaced (browser tests).
    static lookupSources(
        addresses: { bnf?: string; openLibrary?: string } = {},
    ): BookLookupSources {
        const http = new SourceHttp();
        const openLibrary = new OpenLibraryRecords(http, addresses.openLibrary);

        return {
            information: [
                new BnfCatalogue(http, addresses.bnf),
                new OpenLibraryInformation(openLibrary),
            ],
            covers: [new OpenLibraryCovers(openLibrary)],
            downloader: new HttpCoverDownloader(),
        };
    }

    // The titles of member books, kept in line by the collections feature's rename and deletion.
    static memberTitles(books: BookRepository, clock: Clock): MemberTitles {
        return new CollectionMemberTitles(books, clock);
    }
}
