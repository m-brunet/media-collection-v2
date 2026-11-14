import 'reflect-metadata';
import { HttpApplicationModule } from './http-application.module.js';
import { HttpApplication } from '../adapters/driving/web/http-application.adapter.js';
import { AccountLoader } from '../../identity/application/services/account-loader.service.js';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
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
import { KyselyInternetAccessRepository } from '../../server-settings/infrastructure/adapters/driven/persistence/kysely-internet-access.repository.js';
import { FileTlsStore } from '../../server-settings/infrastructure/adapters/driven/persistence/file-tls-store.adapter.js';
import { KyselyHttpSettingsRepository } from '../../server-settings/infrastructure/adapters/driven/persistence/kysely-http-settings.repository.js';
import { HttpSettings } from '../../server-settings/domain/value-objects/http-settings.value-object.js';
import type { TlsSettingsState } from '../../server-settings/domain/value-objects/tls-settings.value-object.js';
import { TlsSettings } from '../../server-settings/domain/value-objects/tls-settings.value-object.js';
import { PemCertificateValidator } from '../../server-settings/infrastructure/adapters/driven/security/pem-certificate-validator.adapter.js';
import { TlsAlpnChallenges } from '../../server-settings/infrastructure/adapters/driven/security/tls-alpn-challenges.adapter.js';
import { ConsoleEventLog } from '../../server-settings/infrastructure/adapters/driven/runtime/console-event-log.adapter.js';
import { NodeHttpsRuntime } from '../../server-settings/infrastructure/adapters/driven/runtime/node-https-runtime.adapter.js';
import { KyselyDomainNameRepository } from '../../server-settings/infrastructure/adapters/driven/persistence/kysely-domain-name.repository.js';
import { KyselyHttpInternetAccessRepository } from '../../server-settings/infrastructure/adapters/driven/persistence/kysely-http-internet-access.repository.js';
import { KyselyKeepAwakeRepository } from '../../server-settings/infrastructure/adapters/driven/persistence/kysely-keep-awake.repository.js';
import { UpnpRouterGateway } from '../../server-settings/infrastructure/adapters/driven/third-party/upnp-router-gateway.adapter.js';
import { HttpPublicAddressProbe } from '../../server-settings/infrastructure/adapters/driven/third-party/http-public-address-probe.adapter.js';
import { OfflineInternetAccess } from '../../server-settings/infrastructure/adapters/driven/runtime/offline-internet-access.adapter.js';
import { DnsDomainNameResolver } from '../../server-settings/infrastructure/adapters/driven/runtime/dns-domain-name-resolver.adapter.js';
import { AcmeCertificateAuthority } from '../../server-settings/infrastructure/adapters/driven/third-party/acme-certificate-authority.adapter.js';
import { AcmeConnector } from '../../server-settings/infrastructure/adapters/driven/third-party/acme-session.adapter.js';
import { AcmeAccountKey } from '../../server-settings/infrastructure/adapters/driven/filesystem/acme-account-key.adapter.js';
import { NetworkLocalAddress } from '../../server-settings/infrastructure/adapters/driven/runtime/network-local-address.adapter.js';
import { DetachedBackgroundTasks } from '../../server-settings/infrastructure/adapters/driven/runtime/detached-background-tasks.adapter.js';
import type { RouterGateway } from '../../server-settings/application/ports/driven/router-gateway.interface.js';
import type { CertificateAuthority } from '../../server-settings/application/ports/driven/certificate-authority.interface.js';
import type { PublicAddressProbe } from '../../server-settings/application/ports/driven/public-address-probe.interface.js';
import type { DomainNameResolver } from '../../server-settings/application/ports/driven/domain-name-resolver.interface.js';
import { IdentityModule } from '../../identity/infrastructure/config/identity.module.js';
import { SettingsModule } from '../../server-settings/infrastructure/config/settings.module.js';
import { HttpSessions } from '../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { HealthController } from '../adapters/driving/web/health.controller.js';
import { LibraryModules } from './library-modules.js';
import { AppearanceModule } from '../../appearance/infrastructure/config/appearance.module.js';
import { KyselyAppearanceRepository } from '../../appearance/infrastructure/adapters/driven/persistence/kysely-appearance.repository.js';
import { KyselyIconSetRepository } from '../../appearance/infrastructure/adapters/driven/persistence/kysely-icon-set.repository.js';
import { MaintenanceModule } from '../../maintenance/infrastructure/config/maintenance.module.js';
import { KyselyApplicationDataEraser } from '../../maintenance/infrastructure/adapters/driven/persistence/kysely-application-data-eraser.adapter.js';
import { KyselyLibraryEraser } from '../../maintenance/infrastructure/adapters/driven/persistence/kysely-library-eraser.adapter.js';
import { KyselyCoverFileCleanup } from '../../maintenance/infrastructure/adapters/driven/persistence/kysely-cover-file-cleanup.adapter.js';
import { FileCoverStorage } from '../../books/infrastructure/adapters/driven/filesystem/file-cover-storage.adapter.js';
import { SetupAccess } from '../../identity/infrastructure/adapters/driving/web/setup-access.service.js';
import { KyselyPairingCodeRepository } from '../../identity/infrastructure/adapters/driven/persistence/kysely-pairing-code.repository.js';
import { CryptoPairingSecrets } from '../../identity/infrastructure/adapters/driven/security/crypto-pairing-secrets.adapter.js';

export interface BackendOptions {
    dataDirectory: string;
    host: string;
    httpPort?: number;
    httpPortSource?: 'command-line' | 'environment' | 'config-file';
    defaultPorts?: { http: number; https: number };
    webDirectory?: string;
    development?: boolean;
    clock?: Clock;
    lookupAddresses?: LookupAddresses;
    setupToken?: string;
    internetAccess?: {
        router: RouterGateway;
        authority: CertificateAuthority;
        probe: PublicAddressProbe;
        resolver: DomainNameResolver;
    };
    offlineInternetAccess?: boolean;
    onKeepAwake?: (enabled: boolean) => void;
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

    async start(options: BackendOptions): Promise<BackendHandle> {
        const ids = new UuidGenerator();
        const database = await Database.open(options.dataDirectory, ids);
        let http: Server | undefined;
        let https: NodeHttpsRuntime | undefined;
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
            const tls = new FileTlsStore(
                database.connections,
                options.dataDirectory,
                storage,
                ids,
                options.defaultPorts?.https,
            );
            const httpSettings = new KyselyHttpSettingsRepository(
                database.connections,
                ids,
                options.defaultPorts?.http,
            );
            const operations = new AuditedOperation(
                database.connections,
                new KyselyAuditTrail(database.connections, ids),
                clock,
                ids,
            );
            const startedHttp = await httpSettings.read();
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
                        httpsPort: https?.port ?? null,
                        httpsError: https?.port ? null : httpsError,
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
            const challenges = new TlsAlpnChallenges();
            const runtime = new NodeHttpsRuntime(application, options.host, challenges);
            const keepAwake = new KyselyKeepAwakeRepository(database.connections, ids);
            const domainName = new KyselyDomainNameRepository(database.connections, ids);
            const httpInternetAccess = new KyselyHttpInternetAccessRepository(
                database.connections,
                ids,
            );
            const internetAccessStore = new KyselyInternetAccessRepository(
                database.connections,
                ids,
            );
            const httpListener = { port: () => httpPort };
            const internetAccess = options.internetAccess ??
                (options.offlineInternetAccess ? OfflineInternetAccess.adapters() : undefined) ?? {
                    router: new UpnpRouterGateway(),
                    authority: new AcmeCertificateAuthority(
                        new AcmeConnector(),
                        new AcmeAccountKey(options.dataDirectory, storage),
                        challenges,
                    ),
                    probe: new HttpPublicAddressProbe(),
                    resolver: new DnsDomainNameResolver(),
                };

            https = runtime;

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
                            {
                                codes: new KyselyPairingCodeRepository(database.connections),
                                secrets: new CryptoPairingSecrets(),
                                addresses: SettingsModule.pairingAddresses({
                                    listeners: {
                                        current: async () =>
                                            (await status.read()).running.addresses,
                                    },
                                    internetAccess: internetAccessStore,
                                    httpInternetAccess,
                                    domainName,
                                    httpListener,
                                }),
                            },
                        ),
                        SettingsModule.register({
                            tls,
                            certificates: new PemCertificateValidator(),
                            status,
                            http: httpSettings,
                            operations,
                            domainName,
                            httpListener,
                            httpInternetAccess,
                            internetAccess: internetAccessStore,
                            ...internetAccess,
                            https: {
                                runningPort: () => runtime.runningPort(),
                                ensureRunning: (port) => runtime.ensureRunning(port),
                                install: async (port, certificate) => {
                                    const installed = await runtime.install(port, certificate);

                                    startedRevision = await tls.revision();

                                    return installed;
                                },
                            },
                            local: new NetworkLocalAddress(),
                            background: new DetachedBackgroundTasks(),
                            keepAwake,
                            keepAwakeRuntime: {
                                apply: (enabled) => options.onKeepAwake?.(enabled),
                            },
                            log: new ConsoleEventLog(),
                            clock,
                        }),
                        AppearanceModule.register(
                            new KyselyAppearanceRepository(database.connections, ids),
                            new KyselyIconSetRepository(database.connections, ids),
                            operations,
                        ),
                        MaintenanceModule.register({
                            passwords: IdentityModule.administratorPassword(users, passwords),
                            eraser: new KyselyApplicationDataEraser(
                                database.connections,
                                new KyselyLibraryEraser(database.connections),
                            ),
                            covers: new KyselyCoverFileCleanup(
                                database.connections,
                                new FileCoverStorage(options.dataDirectory),
                            ),
                            operations,
                            sessions,
                        }),
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
            options.onKeepAwake?.(await keepAwake.read());
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
                        '). Check whether the port is available, or set httpPort in config.json (or start with --http-port <port>) to correct the saved setting.',
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
                    httpsPort = await runtime.start(settings.port, {
                        chain: material.cert.toString(),
                        key: material.key.toString(),
                    });
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
                await runtime.close();
            }

            let closed: Promise<void> | undefined;

            return {
                httpPort,
                httpsPort,
                httpsError,
                close: () => {
                    closed ??= (async () => {
                        try {
                            await Promise.all([this.stop(http), https?.close()]);
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
                await Promise.all([this.stop(http), https?.close()]);
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
