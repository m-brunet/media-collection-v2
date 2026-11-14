import type { DynamicModule } from '@nestjs/common';
import type { Clock } from '../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../shared/application/services/audited-operation.service.js';
import type { Database } from '../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { ActivityModule } from '../../activity/infrastructure/config/activity.module.js';
import { KyselyActivityRecordReader } from '../../activity/infrastructure/adapters/driven/persistence/kysely-activity-record-reader.adapter.js';
import { OverviewModule } from '../../overview/infrastructure/config/overview.module.js';
import { KyselyLibrarySummaryReader } from '../../overview/infrastructure/adapters/driven/persistence/kysely-library-summary-reader.adapter.js';
import { BooksModule } from '../../books/infrastructure/config/books.module.js';
import { CollectionsModule } from '../../collections/infrastructure/config/collections.module.js';
import { LocationsModule } from '../../locations/infrastructure/config/locations.module.js';
import { LendingModule } from '../../lending/infrastructure/config/lending.module.js';
import { TagsModule } from '../../tags/infrastructure/config/tags.module.js';
import { KyselyLoanRepository } from '../../lending/infrastructure/adapters/driven/persistence/kysely-loan.repository.js';
import { KyselyReceiverRepository } from '../../lending/infrastructure/adapters/driven/persistence/kysely-receiver.repository.js';
import { KyselyLendableBooks } from '../../lending/infrastructure/adapters/driven/persistence/kysely-lendable-books.adapter.js';
import { KyselyActiveLoans } from '../../lending/infrastructure/adapters/driven/persistence/kysely-active-loans.adapter.js';
import { KyselyBookcaseRepository } from '../../locations/infrastructure/adapters/driven/persistence/kysely-bookcase.repository.js';
import { KyselyShelfRepository } from '../../locations/infrastructure/adapters/driven/persistence/kysely-shelf.repository.js';
import { KyselyBookShelfStore } from '../../locations/infrastructure/adapters/driven/persistence/kysely-book-shelf-store.adapter.js';
import { KyselyTagRepository } from '../../tags/infrastructure/adapters/driven/persistence/kysely-tag.repository.js';
import { KyselyBookTagStore } from '../../tags/infrastructure/adapters/driven/persistence/kysely-book-tag-store.adapter.js';
import { KyselyCollectionRepository } from '../../collections/infrastructure/adapters/driven/persistence/kysely-collection.repository.js';
import { KyselyCollectionMemberStore } from '../../collections/infrastructure/adapters/driven/persistence/kysely-collection-member-store.adapter.js';
import { KyselyBookRepository } from '../../books/infrastructure/adapters/driven/persistence/kysely-book.repository.js';
import { KyselyAuthorRepository } from '../../books/infrastructure/adapters/driven/persistence/kysely-author.repository.js';
import { KyselyBookCatalog } from '../../books/infrastructure/adapters/driven/persistence/kysely-book-catalog.adapter.js';
import { KyselyReadingStatusRepository } from '../../books/infrastructure/adapters/driven/persistence/kysely-reading-status.repository.js';
import { KyselyPersonalNoteRepository } from '../../books/infrastructure/adapters/driven/persistence/kysely-personal-note.repository.js';
import { FileCoverStorage } from '../../books/infrastructure/adapters/driven/filesystem/file-cover-storage.adapter.js';

export interface LibraryDependencies {
    database: Database;
    dataDirectory: string;
    ids: IdGenerator;
    clock: Clock;
    operations: AuditedOperation;
    lookupAddresses?: LookupAddresses;
}

export type LookupAddresses = { bnf?: string; openLibrary?: string };

export class LibraryModules {
    static register(
        { database, dataDirectory, ids, clock, operations, lookupAddresses }: LibraryDependencies,
        options: { developmentImport?: boolean } = {},
    ): DynamicModule[] {
        const connections = database.connections;
        const catalog = new KyselyBookCatalog(connections);
        const books = new KyselyBookRepository(connections);
        const collections = new KyselyCollectionRepository(connections);
        const members = new KyselyCollectionMemberStore(connections);
        const membership = CollectionsModule.membership(collections, members, ids, clock);
        const bookcases = new KyselyBookcaseRepository(connections);
        const shelves = new KyselyShelfRepository(connections);
        const bookShelves = new KyselyBookShelfStore(connections);
        const tags = new KyselyTagRepository(connections);
        const bookTags = new KyselyBookTagStore(connections);
        const shelving = LocationsModule.assignment(bookcases, shelves, bookShelves);
        const tagging = TagsModule.assignment(tags, bookTags, ids, clock);
        const loans = new KyselyLoanRepository(connections);
        const receivers = new KyselyReceiverRepository(connections);

        return [
            BooksModule.register(
                {
                    books,
                    authors: new KyselyAuthorRepository(connections),
                    catalog,
                    readings: new KyselyReadingStatusRepository(connections),
                    notes: new KyselyPersonalNoteRepository(connections),
                    covers: new FileCoverStorage(dataDirectory),
                    lookup: BooksModule.lookupSources(lookupAddresses),
                    collections: membership,
                    collectionReader: membership,
                    collectionBooks: CollectionsModule.ownedBooks(collections, members),
                    shelves: shelving,
                    locationReader: shelving,
                    tags: tagging,
                    tagReader: tagging,
                    shelfLocator: shelving,
                    tagFinder: tagging,
                    loans: LendingModule.bookLoans(loans, receivers),
                    loanHistory: LendingModule.history(loans),
                    ids,
                    clock,
                    operations,
                },
                options,
            ),
            CollectionsModule.register({
                collections,
                members,
                search: catalog,
                titles: BooksModule.memberTitles(books, clock),
                categories: BooksModule.memberCategories(books, clock),
                clock,
                operations,
            }),
            LocationsModule.register({
                bookcases,
                shelves,
                store: bookShelves,
                ids,
                clock,
                operations,
            }),
            TagsModule.register({ tags, store: bookTags, ids, clock, operations }),
            LendingModule.register({
                loans,
                receivers,
                books: new KyselyLendableBooks(connections),
                active: new KyselyActiveLoans(connections),
                ids,
                clock,
                operations,
            }),
            ActivityModule.register({ records: new KyselyActivityRecordReader(connections) }),
            OverviewModule.register({ summary: new KyselyLibrarySummaryReader(connections) }),
        ];
    }
}
