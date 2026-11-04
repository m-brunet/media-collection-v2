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
import { DatabaseManager } from './database-manager.js';
import type { ApiFixture } from './fixture.js';
import type { TestAppContext } from './test-app-context.js';

export class TestApp {
    private readonly storage = new DatabaseManager();
    private application?: INestApplication;
    private context?: TestAppContext;
    private base?: string;
    private now = Date.parse('2026-01-01T00:00:00.000Z');

    get dependencies(): TestAppContext {
        if (!this.context) {
            throw new Error('TestApp is not initialized.');
        }

        return this.context;
    }

    advance(milliseconds: number): void {
        this.now += milliseconds;
    }

    async setup(): Promise<void> {
        if (this.context || this.application) {
            throw new Error('TestApp is already initialized.');
        }

        try {
            const { database, directory } = await this.storage.setup();
            const users = new KyselyUserRepository(database.connections);
            const passwords = new ScryptPasswordHasher();
            const tls = new FileTlsStore(database.connections, directory, new PrivateStorage());
            const http = new KyselyHttpSettingsRepository(database.connections);

            this.context = { users, passwords, tls, http, audit: new AuditLogProbe(database) };
            const clock = { now: () => new Date(this.now) };
            const secret = randomBytes(32);
            const tokens = new JwtSessionTokens(secret, clock);
            const accounts = new AccountLoader(users);
            const authentication = new AuthenticateSession(accounts, tokens);
            const renewal = new RenewSession(accounts, tokens);
            const sessions = new HttpSessions(secret);
            const ids = new UuidGenerator();
            const operations = new AuditedOperation(
                database.connections,
                new KyselyAuditTrail(database.connections),
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
                    ),
                    SettingsModule.register(
                        tls,
                        new PemCertificateValidator(),
                        status,
                        http,
                        operations,
                    ),
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

    // Puts an account into the temporary-password state (its fixture password stays valid), as
    // after an administrator reset. Needed because only one administrator may exist.
    async requirePasswordReplacement(fixture: UserFixture): Promise<void> {
        const { users, passwords } = this.dependencies;
        const user = (await users.findById(fixture.id))!;
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
