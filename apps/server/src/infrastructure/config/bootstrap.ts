import 'reflect-metadata';
import { HttpApplicationModule } from './http-application.module.js';
import { HttpApplication } from '../adapters/driving/web/http-application.adapter.js';
import { AccountLoader } from '../../identity/application/services/account-loader.service.js';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { Database } from '../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { PrivateStorage } from '../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';
import { SystemClock } from '../../shared/infrastructure/adapters/driven/runtime/system-clock.adapter.js';
import { UuidGenerator } from '../../shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import type { Clock } from '../../shared/application/ports/driven/clock.interface.js';
import type { LookupAddresses } from './library-modules.js';
import { KyselyUserRepository } from '../../identity/infrastructure/adapters/driven/persistence/kysely-user.repository.js';
import { ScryptPasswordHasher } from '../../identity/infrastructure/adapters/driven/security/scrypt-password-hasher.adapter.js';
import { JwtSessionTokens } from '../../identity/infrastructure/adapters/driven/security/jwt-session-tokens.adapter.js';
import { SessionSigningKey } from '../../identity/infrastructure/adapters/driven/filesystem/session-signing-key.adapter.js';
import { AuthenticateSession } from '../../identity/application/use-cases/authenticate-session.usecase.js';
import { RenewSession } from '../../identity/application/use-cases/renew-session.usecase.js';
import { AuditedOperation } from '../../shared/application/services/audited-operation.service.js';
import { KyselyAuditTrail } from '../../shared/infrastructure/adapters/driven/persistence/kysely-audit-trail.adapter.js';
import { FileTlsStore } from '../../server-settings/infrastructure/adapters/driven/persistence/file-tls-store.adapter.js';
import { KyselyHttpSettingsRepository } from '../../server-settings/infrastructure/adapters/driven/persistence/kysely-http-settings.repository.js';
import { HttpSettings } from '../../server-settings/domain/value-objects/http-settings.value-object.js';
import type { TlsSettingsState } from '../../server-settings/domain/value-objects/tls-settings.value-object.js';
import { TlsSettings } from '../../server-settings/domain/value-objects/tls-settings.value-object.js';
import { PemCertificateValidator } from '../../server-settings/infrastructure/adapters/driven/security/pem-certificate-validator.adapter.js';
import { IdentityModule } from '../../identity/infrastructure/config/identity.module.js';
import { SettingsModule } from '../../server-settings/infrastructure/config/settings.module.js';
import { HttpSessions } from '../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { HealthController } from '../adapters/driving/web/health.controller.js';
import { LibraryModules } from './library-modules.js';
import { AppearanceModule } from '../../appearance/infrastructure/config/appearance.module.js';
import { KyselyAppearanceRepository } from '../../appearance/infrastructure/adapters/driven/persistence/kysely-appearance.repository.js';
import { SetupAccess } from '../../identity/infrastructure/adapters/driving/web/setup-access.service.js';

export interface BackendOptions {
    dataDirectory: string;
    host: string;
    httpPort?: number;
    httpPortSource?: 'command-line' | 'environment';
    webDirectory?: string;
    development?: boolean;
    clock?: Clock;
    // Test-only: where Find book asks BnF and Open Library (a local stand-in in browser tests).
    // Production never sets it, so the real catalogue addresses apply.
    lookupAddresses?: LookupAddresses;
    // Per-launch secret that the Electron window attaches to first-launch setup requests.
    setupToken?: string;
}

export interface BackendHandle {
    httpPort: number;
    httpsPort: number | null;
    httpsError: string | null;

    close(): Promise<void>;
}

export class BackendRuntime {
    private listen(server: Server, port: number, host: string): Promise<number> {
        return new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, host, () => {
                server.off('error', reject);
                const address = server.address();

                if (!address || typeof address === 'string') {
                    reject(new Error('Could not determine the listening port.'));

                    return;
                }

                resolve(address.port);
            });
        });
    }

    private stop(server: Server | undefined): Promise<void> {
        if (!server?.listening) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => server.closeAllConnections(), 5000);

            timer.unref();
            server.close((error) => {
                clearTimeout(timer);

                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
            server.closeIdleConnections();
        });
    }

    private addresses(host: string, port: number): string[] {
        const urls = new Set(['http://127.0.0.1:' + port]);

        if (host === '0.0.0.0' || host === '::') {
            for (const interfaces of Object.values(networkInterfaces())) {
                for (const entry of interfaces ?? []) {
                    if (!entry.internal && entry.family === 'IPv4') {
                        urls.add('http://' + entry.address + ':' + port);
                    }
                }
            }
        } else if (host !== '127.0.0.1') {
            urls.add('http://' + (host.includes(':') ? '[' + host + ']' : host) + ':' + port);
        }

        return [...urls];
    }

    // Internal composition entry: production callers are Electron utility-process workers.
    async start(options: BackendOptions): Promise<BackendHandle> {
        const ids = new UuidGenerator();
        const database = await Database.open(options.dataDirectory, ids);
        let http: Server | undefined;
        let https: Server | undefined;
        let nest: Awaited<ReturnType<typeof NestFactory.create>> | undefined;

        try {
            const clock = options.clock ?? new SystemClock();
            const users = new KyselyUserRepository(database.connections);
            const passwords = new ScryptPasswordHasher();
            const storage = new PrivateStorage();
            const secret = new SessionSigningKey(storage).load(options.dataDirectory);
            const tokens = new JwtSessionTokens(secret, clock);
            const accounts = new AccountLoader(users);
            const authentication = new AuthenticateSession(accounts, tokens);
            const renewal = new RenewSession(accounts, tokens);
            const sessions = new HttpSessions(secret, HttpApplication.uploadPaths);
            const tls = new FileTlsStore(database.connections, options.dataDirectory, storage, ids);
            const httpSettings = new KyselyHttpSettingsRepository(database.connections, ids);
            const operations = new AuditedOperation(
                database.connections,
                new KyselyAuditTrail(database.connections, ids),
                clock,
                ids,
            );
            const startedHttp = await httpSettings.read();
            // Only internal fixtures request an ephemeral listener; desktop configuration rejects zero.
            const ephemeralHttp = options.httpPort === 0 && options.httpPortSource === undefined;
            const requestedHttpPort = ephemeralHttp
                ? 0
                : new HttpSettings(options.httpPort ?? startedHttp.port).port;
            let httpPort = 0;
            let httpsPort: number | null = null;
            let httpsError: string | null = null;
            let startedRevision = '';
            let tlsConfiguration: TlsSettingsState | undefined;
            let tlsStartupError: unknown;

            try {
                startedRevision = await tls.revision();
                tlsConfiguration = await tls.read();
            } catch (error) {
                tlsStartupError = error;
            }

            const status = {
                read: async () => ({
                    running: {
                        httpPort,
                        httpsPort,
                        httpsError,
                        addresses: this.addresses(options.host, httpPort),
                        httpPortOverride: options.httpPortSource
                            ? { port: requestedHttpPort, source: options.httpPortSource }
                            : null,
                    },
                    restartRequired:
                        (await httpSettings.read()).port !== startedHttp.port ||
                        (await tls.revision()) !== startedRevision,
                }),
            };
            const application = HttpApplication.create(sessions, options);

            nest = await NestFactory.create(
                {
                    module: HttpApplicationModule,
                    imports: [
                        IdentityModule.register(
                            users,
                            passwords,
                            tokens,
                            ids,
                            clock,
                            sessions,
                            operations,
                            new SetupAccess(options.setupToken ?? null),
                        ),
                        SettingsModule.register(
                            tls,
                            new PemCertificateValidator(),
                            status,
                            httpSettings,
                            operations,
                        ),
                        AppearanceModule.register(
                            new KyselyAppearanceRepository(database.connections, ids),
                            operations,
                        ),
                        ...LibraryModules.register({
                            database,
                            dataDirectory: options.dataDirectory,
                            ids,
                            clock,
                            operations,
                            lookupAddresses: options.lookupAddresses,
                        }),
                    ],
                    controllers: [HealthController],
                },
                new ExpressAdapter(application),
                { logger: false, bodyParser: false, abortOnError: false },
            );
            HttpApplicationModule.configure(nest, authentication, renewal, sessions);
            await nest.init();
            http = createHttpServer(application);

            try {
                httpPort = await this.listen(http, requestedHttpPort, options.host);
            } catch (error) {
                const code =
                    error instanceof Error && 'code' in error
                        ? String(error.code)
                        : 'listen failed';

                throw new Error(
                    'HTTP could not listen on port ' +
                        requestedHttpPort +
                        ' (' +
                        code +
                        '). Check whether the port is available, or start with --http-port <port> to correct the saved setting.',
                    { cause: error },
                );
            }

            try {
                if (tlsStartupError) {
                    throw tlsStartupError;
                }

                if (tlsConfiguration?.enabled) {
                    const settings = new TlsSettings(tlsConfiguration);
                    const material = await tls.material();

                    new PemCertificateValidator().validate(
                        material.cert.toString(),
                        material.key.toString(),
                    );
                    https = createHttpsServer({ ...material, minVersion: 'TLSv1.2' }, application);
                    httpsPort = await this.listen(https, settings.port, options.host);
                }
            } catch (error) {
                const code =
                    error instanceof Error && 'code' in error
                        ? String(error.code) + ': ' + error.message
                        : error instanceof Error
                          ? error.message
                          : 'invalid certificate or settings';

                httpsError =
                    'HTTPS could not start (' +
                    code +
                    '). HTTP is available. Check settings and restart the application.';
                await this.stop(https);
                https = undefined;
            }

            let closed: Promise<void> | undefined;

            return {
                httpPort,
                httpsPort,
                httpsError,
                close: () => {
                    closed ??= (async () => {
                        try {
                            await Promise.all([this.stop(http), this.stop(https)]);
                        } finally {
                            try {
                                await nest?.close();
                            } finally {
                                await database.close();
                            }
                        }
                    })();

                    return closed;
                },
            };
        } catch (error) {
            try {
                await Promise.all([this.stop(http), this.stop(https)]);
            } finally {
                try {
                    await nest?.close();
                } finally {
                    await database.close();
                }
            }

            throw error;
        }
    }
}
