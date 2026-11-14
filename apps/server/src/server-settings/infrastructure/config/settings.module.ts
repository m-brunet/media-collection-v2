import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { BackgroundTasks } from '../../application/ports/driven/background-tasks.interface.js';
import type { CertificateAuthority } from '../../application/ports/driven/certificate-authority.interface.js';
import type { CertificateValidator } from '../../application/ports/driven/certificate-validator.interface.js';
import type { DomainNameResolver } from '../../application/ports/driven/domain-name-resolver.interface.js';
import type { DomainNameStore } from '../../application/ports/driven/domain-name-store.interface.js';
import type { EventLog } from '../../application/ports/driven/event-log.interface.js';
import type { HttpSettingsStore } from '../../application/ports/driven/http-settings-store.interface.js';
import type { HttpsRuntime } from '../../application/ports/driven/https-runtime.interface.js';
import type { HttpInternetAccessStore } from '../../application/ports/driven/http-internet-access-store.interface.js';
import type { HttpListener } from '../../application/ports/driven/http-listener.interface.js';
import type { InternetAccessStore } from '../../application/ports/driven/internet-access-store.interface.js';
import type { KeepAwakeRuntime } from '../../application/ports/driven/keep-awake-runtime.interface.js';
import type { KeepAwakeStore } from '../../application/ports/driven/keep-awake-store.interface.js';
import type { LocalAddressReader } from '../../application/ports/driven/local-address-reader.interface.js';
import type { PublicAddressProbe } from '../../application/ports/driven/public-address-probe.interface.js';
import type { RouterGateway } from '../../application/ports/driven/router-gateway.interface.js';
import type { TlsCertificateReader } from '../../application/ports/driven/tls-certificate-reader.interface.js';
import type { TlsStore } from '../../application/ports/driven/tls-store.interface.js';
import type { MaintainInternetAccessUseCase } from '../../application/ports/driving/maintain-internet-access-use-case.interface.js';
import type { MaintainHttpInternetAccessUseCase } from '../../application/ports/driving/maintain-http-internet-access-use-case.interface.js';
import { CheckPortWindow } from '../../application/services/check-port-window.service.js';
import { DomainNameCheck } from '../../application/services/domain-name-check.service.js';
import { HttpsRuleMove } from '../../application/services/https-rule-move.service.js';
import { HttpInternetAccessClosing } from '../../application/services/http-internet-access-closing.service.js';
import { HttpPortForwarding } from '../../application/services/http-port-forwarding.service.js';
import { InternetAccessSetup } from '../../application/services/internet-access-setup.service.js';
import { RouterRules } from '../../application/services/router-rules.service.js';
import { CheckInternetAccess } from '../../application/use-cases/check-internet-access.usecase.js';
import { CloseHttpInternetAccess } from '../../application/use-cases/close-http-internet-access.usecase.js';
import { MaintainHttpInternetAccess } from '../../application/use-cases/maintain-http-internet-access.usecase.js';
import { OpenHttpInternetAccess } from '../../application/use-cases/open-http-internet-access.usecase.js';
import { ReadHttpInternetAccess } from '../../application/use-cases/read-http-internet-access.usecase.js';
import { MaintainInternetAccess } from '../../application/use-cases/maintain-internet-access.usecase.js';
import { ReadDomainName } from '../../application/use-cases/read-domain-name.usecase.js';
import { ReadHttpSettings } from '../../application/use-cases/read-http-settings.usecase.js';
import { ReadInternetAccess } from '../../application/use-cases/read-internet-access.usecase.js';
import { ReadKeepAwake } from '../../application/use-cases/read-keep-awake.usecase.js';
import { ReadTlsSettings } from '../../application/use-cases/read-tls-settings.usecase.js';
import { SaveDomainName } from '../../application/use-cases/save-domain-name.usecase.js';
import { SaveHttpSettings } from '../../application/use-cases/save-http-settings.usecase.js';
import { SaveKeepAwake } from '../../application/use-cases/save-keep-awake.usecase.js';
import { SaveTlsSettings } from '../../application/use-cases/save-tls-settings.usecase.js';
import { SetUpInternetAccess } from '../../application/use-cases/set-up-internet-access.usecase.js';
import { TurnOffInternetAccess } from '../../application/use-cases/turn-off-internet-access.usecase.js';
import { UpkeepSchedule } from '../../domain/services/upkeep-schedule.service.js';
import { InternetAccessUpkeep } from '../adapters/driving/schedule/internet-access-upkeep.adapter.js';
import { DomainNameController } from '../adapters/driving/web/domain-name.controller.js';
import { HttpInternetAccessController } from '../adapters/driving/web/http-internet-access.controller.js';
import { InternetAccessController } from '../adapters/driving/web/internet-access.controller.js';
import { KeepAwakeController } from '../adapters/driving/web/keep-awake.controller.js';
import type { RuntimeStatus } from '../adapters/driving/web/settings.controller.js';
import { SettingsController } from '../adapters/driving/web/settings.controller.js';
import type { PairingAddresses } from '../../../identity/application/ports/driven/pairing-addresses.interface.js';
import type { ListenerAddressReader } from '../../application/ports/driven/listener-address-reader.interface.js';
import { PairingAddressPolicy } from '../../application/services/pairing-address-policy.service.js';

export const SERVER_SETTINGS_TLS_STORE = 'SERVER_SETTINGS_TLS_STORE';
export const SERVER_SETTINGS_CERTIFICATE_VALIDATOR = 'SERVER_SETTINGS_CERTIFICATE_VALIDATOR';
export const SERVER_SETTINGS_RUNTIME_STATUS = 'SERVER_SETTINGS_RUNTIME_STATUS';
export const SERVER_SETTINGS_HTTP_SETTINGS_STORE = 'SERVER_SETTINGS_HTTP_SETTINGS_STORE';
export const SERVER_SETTINGS_READ_TLS_SETTINGS = 'SERVER_SETTINGS_READ_TLS_SETTINGS';
export const SERVER_SETTINGS_SAVE_TLS_SETTINGS = 'SERVER_SETTINGS_SAVE_TLS_SETTINGS';
export const SERVER_SETTINGS_READ_HTTP_SETTINGS = 'SERVER_SETTINGS_READ_HTTP_SETTINGS';
export const SERVER_SETTINGS_SAVE_HTTP_SETTINGS = 'SERVER_SETTINGS_SAVE_HTTP_SETTINGS';
export const SERVER_SETTINGS_AUDITED_OPERATION = 'SERVER_SETTINGS_AUDITED_OPERATION';
export const SERVER_SETTINGS_INTERNET_ACCESS_STORE = 'SERVER_SETTINGS_INTERNET_ACCESS_STORE';
export const SERVER_SETTINGS_INTERNET_ACCESS_SETUP = 'SERVER_SETTINGS_INTERNET_ACCESS_SETUP';
export const SERVER_SETTINGS_READ_INTERNET_ACCESS = 'SERVER_SETTINGS_READ_INTERNET_ACCESS';
export const SERVER_SETTINGS_SET_UP_INTERNET_ACCESS = 'SERVER_SETTINGS_SET_UP_INTERNET_ACCESS';
export const SERVER_SETTINGS_CHECK_INTERNET_ACCESS = 'SERVER_SETTINGS_CHECK_INTERNET_ACCESS';
export const SERVER_SETTINGS_TURN_OFF_INTERNET_ACCESS = 'SERVER_SETTINGS_TURN_OFF_INTERNET_ACCESS';
export const SERVER_SETTINGS_MAINTAIN_INTERNET_ACCESS = 'SERVER_SETTINGS_MAINTAIN_INTERNET_ACCESS';
export const SERVER_SETTINGS_INTERNET_ACCESS_UPKEEP = 'SERVER_SETTINGS_INTERNET_ACCESS_UPKEEP';
export const SERVER_SETTINGS_READ_KEEP_AWAKE = 'SERVER_SETTINGS_READ_KEEP_AWAKE';
export const SERVER_SETTINGS_SAVE_KEEP_AWAKE = 'SERVER_SETTINGS_SAVE_KEEP_AWAKE';
export const SERVER_SETTINGS_READ_DOMAIN_NAME = 'SERVER_SETTINGS_READ_DOMAIN_NAME';
export const SERVER_SETTINGS_SAVE_DOMAIN_NAME = 'SERVER_SETTINGS_SAVE_DOMAIN_NAME';
export const SERVER_SETTINGS_OPEN_HTTP_INTERNET_ACCESS =
    'SERVER_SETTINGS_OPEN_HTTP_INTERNET_ACCESS';
export const SERVER_SETTINGS_CLOSE_HTTP_INTERNET_ACCESS =
    'SERVER_SETTINGS_CLOSE_HTTP_INTERNET_ACCESS';
export const SERVER_SETTINGS_READ_HTTP_INTERNET_ACCESS =
    'SERVER_SETTINGS_READ_HTTP_INTERNET_ACCESS';
export const SERVER_SETTINGS_MAINTAIN_HTTP_INTERNET_ACCESS =
    'SERVER_SETTINGS_MAINTAIN_HTTP_INTERNET_ACCESS';

export interface SettingsAdapters {
    tls: TlsStore & TlsCertificateReader;
    certificates: CertificateValidator;
    status: RuntimeStatus;
    http: HttpSettingsStore;
    operations: AuditedOperation;
    internetAccess: InternetAccessStore;
    domainName: DomainNameStore;
    httpInternetAccess: HttpInternetAccessStore;
    httpListener: HttpListener;
    router: RouterGateway;
    probe: PublicAddressProbe;
    resolver: DomainNameResolver;
    authority: CertificateAuthority;
    https: HttpsRuntime;
    local: LocalAddressReader;
    background: BackgroundTasks;
    keepAwake: KeepAwakeStore;
    keepAwakeRuntime: KeepAwakeRuntime;
    log: EventLog;
    clock: Clock;
}

@Module({})
export class SettingsModule {
    static register(adapters: SettingsAdapters): DynamicModule {
        const {
            tls,
            certificates,
            status,
            http,
            operations,
            internetAccess,
            domainName,
            httpInternetAccess,
            httpListener,
            router,
            probe,
            resolver,
            authority,
            https,
            local,
            background,
            keepAwake,
            keepAwakeRuntime,
            log,
            clock,
        } = adapters;
        const domains = new DomainNameCheck(resolver);
        const rules = new RouterRules(router, probe);
        const forwarding = new HttpPortForwarding(rules, httpListener, clock);
        const window = new CheckPortWindow(rules, log);

        return {
            module: SettingsModule,
            controllers: [
                SettingsController,
                InternetAccessController,
                DomainNameController,
                HttpInternetAccessController,
                KeepAwakeController,
            ],
            providers: [
                { provide: SERVER_SETTINGS_TLS_STORE, useValue: tls },
                { provide: SERVER_SETTINGS_CERTIFICATE_VALIDATOR, useValue: certificates },
                { provide: SERVER_SETTINGS_RUNTIME_STATUS, useValue: status },
                { provide: SERVER_SETTINGS_HTTP_SETTINGS_STORE, useValue: http },
                { provide: SERVER_SETTINGS_AUDITED_OPERATION, useValue: operations },
                { provide: SERVER_SETTINGS_INTERNET_ACCESS_STORE, useValue: internetAccess },
                {
                    provide: SERVER_SETTINGS_READ_TLS_SETTINGS,
                    useFactory: () => new ReadTlsSettings(tls),
                },
                {
                    provide: SERVER_SETTINGS_SAVE_TLS_SETTINGS,
                    useFactory: () =>
                        new SaveTlsSettings(tls, certificates, http, internetAccess, operations),
                },
                {
                    provide: SERVER_SETTINGS_READ_HTTP_SETTINGS,
                    useFactory: () => new ReadHttpSettings(http),
                },
                {
                    provide: SERVER_SETTINGS_SAVE_HTTP_SETTINGS,
                    useFactory: () =>
                        new SaveHttpSettings(http, tls, httpInternetAccess, operations),
                },
                {
                    provide: SERVER_SETTINGS_INTERNET_ACCESS_SETUP,
                    useFactory: () =>
                        new InternetAccessSetup(
                            internetAccess,
                            rules,
                            authority,
                            https,
                            tls,
                            domains,
                            domainName,
                            new HttpInternetAccessClosing(httpInternetAccess, forwarding),
                            window,
                            clock,
                        ),
                },
                {
                    provide: SERVER_SETTINGS_READ_INTERNET_ACCESS,
                    useFactory: () => new ReadInternetAccess(internetAccess, tls, local, clock),
                },
                {
                    provide: SERVER_SETTINGS_SET_UP_INTERNET_ACCESS,
                    inject: [SERVER_SETTINGS_INTERNET_ACCESS_SETUP],
                    useFactory: (setup: InternetAccessSetup) =>
                        new SetUpInternetAccess(
                            internetAccess,
                            tls,
                            domainName,
                            setup,
                            background,
                            operations,
                            clock,
                        ),
                },
                {
                    provide: SERVER_SETTINGS_CHECK_INTERNET_ACCESS,
                    inject: [SERVER_SETTINGS_INTERNET_ACCESS_SETUP],
                    useFactory: (setup: InternetAccessSetup) =>
                        new CheckInternetAccess(
                            internetAccess,
                            setup,
                            background,
                            operations,
                            clock,
                        ),
                },
                {
                    provide: SERVER_SETTINGS_TURN_OFF_INTERNET_ACCESS,
                    useFactory: () => new TurnOffInternetAccess(internetAccess, router, operations),
                },
                {
                    provide: SERVER_SETTINGS_MAINTAIN_INTERNET_ACCESS,
                    inject: [SERVER_SETTINGS_INTERNET_ACCESS_SETUP],
                    useFactory: (setup: InternetAccessSetup) =>
                        new MaintainInternetAccess(
                            internetAccess,
                            rules,
                            tls,
                            setup,
                            domains,
                            domainName,
                            window,
                            new HttpsRuleMove(rules, log),
                            clock,
                        ),
                },
                {
                    provide: SERVER_SETTINGS_OPEN_HTTP_INTERNET_ACCESS,
                    useFactory: () =>
                        new OpenHttpInternetAccess(
                            httpInternetAccess,
                            internetAccess,
                            forwarding,
                            operations,
                        ),
                },
                {
                    provide: SERVER_SETTINGS_CLOSE_HTTP_INTERNET_ACCESS,
                    useFactory: () =>
                        new CloseHttpInternetAccess(httpInternetAccess, forwarding, operations),
                },
                {
                    provide: SERVER_SETTINGS_READ_HTTP_INTERNET_ACCESS,
                    useFactory: () =>
                        new ReadHttpInternetAccess(
                            httpInternetAccess,
                            domainName,
                            httpListener,
                            local,
                        ),
                },
                {
                    provide: SERVER_SETTINGS_MAINTAIN_HTTP_INTERNET_ACCESS,
                    useFactory: () =>
                        new MaintainHttpInternetAccess(httpInternetAccess, forwarding, clock),
                },
                {
                    provide: SERVER_SETTINGS_INTERNET_ACCESS_UPKEEP,
                    inject: [
                        SERVER_SETTINGS_MAINTAIN_INTERNET_ACCESS,
                        SERVER_SETTINGS_MAINTAIN_HTTP_INTERNET_ACCESS,
                    ],
                    useFactory: (
                        maintainHttps: MaintainInternetAccessUseCase,
                        maintainHttp: MaintainHttpInternetAccessUseCase,
                    ) =>
                        new InternetAccessUpkeep(
                            [
                                { name: 'HTTPS', maintenance: maintainHttps },
                                { name: 'HTTP', maintenance: maintainHttp },
                            ],
                            (failedRuns) => UpkeepSchedule.delayAfter(failedRuns),
                        ),
                },
                {
                    provide: SERVER_SETTINGS_READ_DOMAIN_NAME,
                    useFactory: () => new ReadDomainName(domainName),
                },
                {
                    provide: SERVER_SETTINGS_SAVE_DOMAIN_NAME,
                    inject: [SERVER_SETTINGS_INTERNET_ACCESS_SETUP],
                    useFactory: (setup: InternetAccessSetup) =>
                        new SaveDomainName(
                            domainName,
                            internetAccess,
                            rules,
                            domains,
                            setup,
                            background,
                            operations,
                        ),
                },
                {
                    provide: SERVER_SETTINGS_READ_KEEP_AWAKE,
                    useFactory: () => new ReadKeepAwake(keepAwake),
                },
                {
                    provide: SERVER_SETTINGS_SAVE_KEEP_AWAKE,
                    useFactory: () => new SaveKeepAwake(keepAwake, keepAwakeRuntime, operations),
                },
            ],
        };
    }

    static pairingAddresses(
        adapters: Pick<
            SettingsAdapters,
            'internetAccess' | 'httpInternetAccess' | 'domainName' | 'httpListener'
        > & { listeners: ListenerAddressReader },
    ): PairingAddresses {
        return new PairingAddressPolicy(
            adapters.listeners,
            adapters.internetAccess,
            adapters.httpInternetAccess,
            adapters.domainName,
            adapters.httpListener,
        );
    }
}
