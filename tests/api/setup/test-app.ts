import { KyselyDomainNameRepository } from '../../../apps/server/src/server-settings/infrastructure/adapters/driven/persistence/kysely-domain-name.repository.js';
import { KyselyHttpInternetAccessRepository } from '../../../apps/server/src/server-settings/infrastructure/adapters/driven/persistence/kysely-http-internet-access.repository.js';
import { KyselyInternetAccessRepository } from '../../../apps/server/src/server-settings/infrastructure/adapters/driven/persistence/kysely-internet-access.repository.js';
import {
    AwaitableBackground,
    FakeAuthority,
    FakeHttpsRuntime,
    FakeProbe,
    FakeResolver,
    FakeRouter,
    FixedLocalAddress,
    InternetAccessDoubles,
    MemoryKeepAwake,
} from '../../../apps/server/src/server-settings/application/testing/internet-access-doubles.test-support.js';
import { HttpInternetAccess } from '../../../apps/server/src/server-settings/domain/entities/http-internet-access.entity.js';
import { HttpApplicationModule } from '../../../apps/server/src/infrastructure/config/http-application.module.js';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { randomBytes } from 'node:crypto';
import { KyselyUserRepository } from '../../../apps/server/src/identity/infrastructure/adapters/driven/persistence/kysely-user.repository.js';
import { ScryptPasswordHasher } from '../../../apps/server/src/identity/infrastructure/adapters/driven/security/scrypt-password-hasher.adapter.js';
import { JwtSessionTokens } from '../../../apps/server/src/identity/infrastructure/adapters/driven/security/jwt-session-tokens.adapter.js';
import { AuthenticateSession } from '../../../apps/server/src/identity/application/use-cases/authenticate-session.usecase.js';
import { RenewSession } from '../../../apps/server/src/identity/application/use-cases/renew-session.usecase.js';
import { AccountLoader } from '../../../apps/server/src/identity/application/services/account-loader.service.js';
import { FileTlsStore } from '../../../apps/server/src/server-settings/infrastructure/adapters/driven/persistence/file-tls-store.adapter.js';
import { KyselyHttpSettingsRepository } from '../../../apps/server/src/server-settings/infrastructure/adapters/driven/persistence/kysely-http-settings.repository.js';
import { PemCertificateValidator } from '../../../apps/server/src/server-settings/infrastructure/adapters/driven/security/pem-certificate-validator.adapter.js';
import { IdentityModule } from '../../../apps/server/src/identity/infrastructure/config/identity.module.js';
import { SettingsModule } from '../../../apps/server/src/server-settings/infrastructure/config/settings.module.js';
import { HttpSessions } from '../../../apps/server/src/shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { HealthController } from '../../../apps/server/src/infrastructure/adapters/driving/web/health.controller.js';
import { HttpApplication } from '../../../apps/server/src/infrastructure/adapters/driving/web/http-application.adapter.js';
import { UuidGenerator } from '../../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { PrivateStorage } from '../../../apps/server/src/shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';
import { Client } from '../client.js';
import { UserFixture } from '../fixtures/user.fixture.js';
import { AuditedOperation } from '../../../apps/server/src/shared/application/services/audited-operation.service.js';
import { KyselyAuditTrail } from '../../../apps/server/src/shared/infrastructure/adapters/driven/persistence/kysely-audit-trail.adapter.js';
import { AuditLogProbe } from './audit-log-probe.js';
import { LibraryProbe } from './library-probe.js';
import { ScriptedLookupSources } from '../fixtures/scripted-lookup-sources.js';
import { AppearanceModule } from '../../../apps/server/src/appearance/infrastructure/config/appearance.module.js';
import { KyselyAppearanceRepository } from '../../../apps/server/src/appearance/infrastructure/adapters/driven/persistence/kysely-appearance.repository.js';
import { KyselyIconSetRepository } from '../../../apps/server/src/appearance/infrastructure/adapters/driven/persistence/kysely-icon-set.repository.js';
import { SetupAccess } from '../../../apps/server/src/identity/infrastructure/adapters/driving/web/setup-access.service.js';
import { KyselyPairingCodeRepository } from '../../../apps/server/src/identity/infrastructure/adapters/driven/persistence/kysely-pairing-code.repository.js';
import { CryptoPairingSecrets } from '../../../apps/server/src/identity/infrastructure/adapters/driven/security/crypto-pairing-secrets.adapter.js';
import { BooksModule } from '../../../apps/server/src/books/infrastructure/config/books.module.js';
import { CollectionsModule } from '../../../apps/server/src/collections/infrastructure/config/collections.module.js';
import { LocationsModule } from '../../../apps/server/src/locations/infrastructure/config/locations.module.js';
import { LendingModule } from '../../../apps/server/src/lending/infrastructure/config/lending.module.js';
import { KyselyLoanRepository } from '../../../apps/server/src/lending/infrastructure/adapters/driven/persistence/kysely-loan.repository.js';
import { KyselyReceiverRepository } from '../../../apps/server/src/lending/infrastructure/adapters/driven/persistence/kysely-receiver.repository.js';
import { KyselyLendableBooks } from '../../../apps/server/src/lending/infrastructure/adapters/driven/persistence/kysely-lendable-books.adapter.js';
import { KyselyActiveLoans } from '../../../apps/server/src/lending/infrastructure/adapters/driven/persistence/kysely-active-loans.adapter.js';
import { KyselyBookcaseRepository } from '../../../apps/server/src/locations/infrastructure/adapters/driven/persistence/kysely-bookcase.repository.js';
import { KyselyShelfRepository } from '../../../apps/server/src/locations/infrastructure/adapters/driven/persistence/kysely-shelf.repository.js';
import { KyselyBookShelfStore } from '../../../apps/server/src/locations/infrastructure/adapters/driven/persistence/kysely-book-shelf-store.adapter.js';
import { TagsModule } from '../../../apps/server/src/tags/infrastructure/config/tags.module.js';
import { KyselyTagRepository } from '../../../apps/server/src/tags/infrastructure/adapters/driven/persistence/kysely-tag.repository.js';
import { KyselyBookTagStore } from '../../../apps/server/src/tags/infrastructure/adapters/driven/persistence/kysely-book-tag-store.adapter.js';
import { KyselyCollectionRepository } from '../../../apps/server/src/collections/infrastructure/adapters/driven/persistence/kysely-collection.repository.js';
import { KyselyCollectionMemberStore } from '../../../apps/server/src/collections/infrastructure/adapters/driven/persistence/kysely-collection-member-store.adapter.js';
import { KyselyCategoryMismatchReader } from '../../../apps/server/src/collections/infrastructure/adapters/driven/persistence/kysely-category-mismatch-reader.adapter.js';
import { KyselyBookRepository } from '../../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-book.repository.js';
import { KyselyAuthorRepository } from '../../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-author.repository.js';
import { KyselyBookCatalog } from '../../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-book-catalog.adapter.js';
import { KyselyReadingStatusRepository } from '../../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-reading-status.repository.js';
import { KyselyPersonalNoteRepository } from '../../../apps/server/src/books/infrastructure/adapters/driven/persistence/kysely-personal-note.repository.js';
import { FileCoverStorage } from '../../../apps/server/src/books/infrastructure/adapters/driven/filesystem/file-cover-storage.adapter.js';
import { ActivityModule } from '../../../apps/server/src/activity/infrastructure/config/activity.module.js';
import { KyselyActivityRecordReader } from '../../../apps/server/src/activity/infrastructure/adapters/driven/persistence/kysely-activity-record-reader.adapter.js';
import { MaintenanceModule } from '../../../apps/server/src/maintenance/infrastructure/config/maintenance.module.js';
import { KyselyApplicationDataEraser } from '../../../apps/server/src/maintenance/infrastructure/adapters/driven/persistence/kysely-application-data-eraser.adapter.js';
import { KyselyLibraryEraser } from '../../../apps/server/src/maintenance/infrastructure/adapters/driven/persistence/kysely-library-eraser.adapter.js';
import { KyselyCoverFileCleanup } from '../../../apps/server/src/maintenance/infrastructure/adapters/driven/persistence/kysely-cover-file-cleanup.adapter.js';
import { OverviewModule } from '../../../apps/server/src/overview/infrastructure/config/overview.module.js';
import { KyselyLibrarySummaryReader } from '../../../apps/server/src/overview/infrastructure/adapters/driven/persistence/kysely-library-summary-reader.adapter.js';
import { DatabaseManager } from './database-manager.js';
import type { ApiFixture } from './fixture.js';
import { TestLibrary } from '../fixtures/test-library.js';
import type { TestAppContext } from './test-app-context.js';
import { Required } from '../../../apps/server/src/shared/domain/required.helper.js';

export class TestApp {
    private readonly storage = new DatabaseManager();
    private application?: INestApplication;
    private context?: TestAppContext;
    private base?: string;
    private now = Date.parse('2026-01-01T00:00:00.000Z');
    private readonly listenerAddresses: string[] = [];

    get dependencies(): TestAppContext {
        if (!this.context) {
            throw new Error('TestApp is not initialized.');
        }

        return this.context;
    }

    advance(milliseconds: number): void {
        this.now += milliseconds;
    }

    listenOn(address: string): void {
        this.listenerAddresses.push(address);
    }

    async openHttpInternetAccess(): Promise<void> {
        await this.dependencies.internetAccess.http.save(
            new HttpInternetAccess(InternetAccessDoubles.httpOpen()),
        );
    }

    async setup(): Promise<void> {
        if (this.context || this.application) {
            throw new Error('TestApp is already initialized.');
        }

        try {
            const { database, directory } = await this.storage.setup();
            const ids = new UuidGenerator();
            const users = new KyselyUserRepository(database.connections);
            const passwords = new ScryptPasswordHasher();
            const tls = new FileTlsStore(
                database.connections,
                directory,
                new PrivateStorage(),
                ids,
            );
            const http = new KyselyHttpSettingsRepository(database.connections, ids);
            const appearance = new KyselyAppearanceRepository(database.connections, ids);
            const books = {
                books: new KyselyBookRepository(database.connections),
                authors: new KyselyAuthorRepository(database.connections),
                catalog: new KyselyBookCatalog(database.connections),
                readings: new KyselyReadingStatusRepository(database.connections),
                notes: new KyselyPersonalNoteRepository(database.connections),
                covers: new FileCoverStorage(directory),
                lookup: new ScriptedLookupSources(),
            };
            const collections = new KyselyCollectionRepository(database.connections);
            const members = new KyselyCollectionMemberStore(database.connections);
            const loans = new KyselyLoanRepository(database.connections);
            const receivers = new KyselyReceiverRepository(database.connections);
            const clock = { now: () => new Date(this.now) };
            const internetAccess = {
                store: new KyselyInternetAccessRepository(database.connections, ids),
                domainName: new KyselyDomainNameRepository(database.connections, ids),
                http: new KyselyHttpInternetAccessRepository(database.connections, ids),
                router: new FakeRouter(),
                authority: new FakeAuthority(clock),
                probe: new FakeProbe(),
                resolver: new FakeResolver(),
                https: new FakeHttpsRuntime(),
                background: new AwaitableBackground(),
                keepAwake: new MemoryKeepAwake(),
            };

            this.context = {
                users,
                passwords,
                tls,
                http,
                appearance,
                books,
                audit: new AuditLogProbe(database),
                library: new LibraryProbe(database),
                lending: { loans, receivers },
                internetAccess,
                builders: new TestLibrary({
                    books: books.books,
                    authors: books.authors,
                    loans,
                    receivers,
                }),
            };
            const membership = CollectionsModule.membership(collections, members, ids, clock);
            const bookcases = new KyselyBookcaseRepository(database.connections);
            const shelves = new KyselyShelfRepository(database.connections);
            const bookShelves = new KyselyBookShelfStore(database.connections);
            const tags = new KyselyTagRepository(database.connections);
            const bookTags = new KyselyBookTagStore(database.connections);
            const shelving = LocationsModule.assignment(bookcases, shelves, bookShelves);
            const tagging = TagsModule.assignment(tags, bookTags, ids, clock);
            const secret = randomBytes(32);
            const tokens = new JwtSessionTokens(secret, clock);
            const accounts = new AccountLoader(users);
            const authentication = new AuthenticateSession(accounts, tokens);
            const renewal = new RenewSession(accounts, tokens);
            const sessions = new HttpSessions(secret, HttpApplication.uploadPaths);
            const operations = new AuditedOperation(
                database.connections,
                new KyselyAuditTrail(database.connections, ids),
                clock,
                ids,
            );
            const initialRevision = await tls.revision();
            const initialHttp = await http.read();
            const status = {
                read: async () => ({
                    running: {
                        httpPort: this.base ? Number(new URL(this.base).port) : 0,
                        httpsPort: null,
                        httpsError: null,
                        addresses: this.base ? [this.base] : [],
                        httpPortOverride: null,
                    },
                    restartRequired:
                        (await http.read()).port !== initialHttp.port ||
                        (await tls.revision()) !== initialRevision,
                }),
            };
            const module = await Test.createTestingModule({
                imports: [
                    IdentityModule.register(
                        users,
                        passwords,
                        tokens,
                        ids,
                        clock,
                        sessions,
                        operations,
                        new SetupAccess('test-setup-token'),
                        {
                            codes: new KyselyPairingCodeRepository(database.connections),
                            secrets: new CryptoPairingSecrets(),
                            addresses: SettingsModule.pairingAddresses({
                                listeners: {
                                    current: async () => [
                                        ...(await status.read()).running.addresses,
                                        ...this.listenerAddresses,
                                    ],
                                },
                                internetAccess: internetAccess.store,
                                httpInternetAccess: internetAccess.http,
                                domainName: internetAccess.domainName,
                                httpListener: { port: () => 34345 },
                            }),
                        },
                    ),
                    SettingsModule.register({
                        tls,
                        certificates: new PemCertificateValidator(),
                        status,
                        http,
                        operations,
                        internetAccess: internetAccess.store,
                        domainName: internetAccess.domainName,
                        httpInternetAccess: internetAccess.http,
                        httpListener: { port: () => 34345 },
                        router: internetAccess.router,
                        probe: internetAccess.probe,
                        resolver: internetAccess.resolver,
                        authority: internetAccess.authority,
                        https: internetAccess.https,
                        local: new FixedLocalAddress(),
                        background: internetAccess.background,
                        keepAwake: internetAccess.keepAwake,
                        keepAwakeRuntime: internetAccess.keepAwake,
                        clock,
                    }),
                    AppearanceModule.register(
                        appearance,
                        new KyselyIconSetRepository(database.connections, ids),
                        operations,
                    ),
                    BooksModule.register({
                        ...books,
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
                    }),
                    CollectionsModule.register({
                        collections,
                        members,
                        search: books.catalog,
                        titles: BooksModule.memberTitles(books.books, clock),
                        categories: BooksModule.memberCategories(books.books, clock),
                        mismatches: new KyselyCategoryMismatchReader(database.connections),
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
                        books: new KyselyLendableBooks(database.connections),
                        active: new KyselyActiveLoans(database.connections),
                        ids,
                        clock,
                        operations,
                    }),
                    ActivityModule.register({
                        records: new KyselyActivityRecordReader(database.connections),
                    }),
                    OverviewModule.register({
                        summary: new KyselyLibrarySummaryReader(database.connections),
                    }),
                    MaintenanceModule.register({
                        passwords: IdentityModule.administratorPassword(users, passwords),
                        eraser: new KyselyApplicationDataEraser(
                            database.connections,
                            new KyselyLibraryEraser(database.connections),
                        ),
                        covers: new KyselyCoverFileCleanup(
                            database.connections,
                            new FileCoverStorage(directory),
                        ),
                        operations,
                        sessions,
                    }),
                ],
                controllers: [HealthController],
            }).compile();

            this.application = module.createNestApplication(
                new ExpressAdapter(HttpApplication.create(sessions)),
                { logger: false, bodyParser: false },
            );
            HttpApplicationModule.configure(this.application, authentication, renewal, sessions);
            await this.application.listen(0, '127.0.0.1');
            this.base = await this.application.getUrl();
        } catch (error) {
            await this.teardown();
            throw error;
        }
    }

    client(): Client {
        if (!this.base) {
            throw new Error('TestApp is not initialized.');
        }

        return new Client(this.base);
    }

    async authenticatedClient(user: UserFixture): Promise<Client> {
        const client = this.client();
        const result = await client.login(user.username, user.password);

        if (result.status !== 200) {
            throw new Error('Fixture login failed: ' + result.text);
        }

        return client;
    }

    async requirePasswordReplacement(fixture: UserFixture): Promise<void> {
        const { users, passwords } = this.dependencies;
        const user = Required.value(
            await users.findById(fixture.id),
            'user ' + fixture.id + ' exists',
        );
        const version = user.snapshot.tokenVersion;

        user.replacePassword(await passwords.hash(fixture.password), true);
        await users.save(user, version);
    }

    async loadFixtures(fixtures: readonly ApiFixture[]): Promise<void> {
        for (const fixture of fixtures) {
            await fixture.save(this.dependencies);
        }
    }

    async teardown(): Promise<void> {
        try {
            await this.application?.close();
        } finally {
            this.application = undefined;
            this.context = undefined;
            this.base = undefined;
            await this.storage.teardown();
        }
    }
}
