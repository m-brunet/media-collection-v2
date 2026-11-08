import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { BackgroundTasks } from '../../application/ports/driven/background-tasks.interface.js';
import type { CertificateAuthority } from '../../application/ports/driven/certificate-authority.interface.js';
import type { CertificateValidator } from '../../application/ports/driven/certificate-validator.interface.js';
import type { HttpSettingsStore } from '../../application/ports/driven/http-settings-store.interface.js';
import type { HttpsRuntime } from '../../application/ports/driven/https-runtime.interface.js';
import type { InternetAccessStore } from '../../application/ports/driven/internet-access-store.interface.js';
import type { KeepAwakeRuntime } from '../../application/ports/driven/keep-awake-runtime.interface.js';
import type { KeepAwakeStore } from '../../application/ports/driven/keep-awake-store.interface.js';
import type { LocalAddressReader } from '../../application/ports/driven/local-address-reader.interface.js';
import type { PublicAddressProbe } from '../../application/ports/driven/public-address-probe.interface.js';
import type { RouterGateway } from '../../application/ports/driven/router-gateway.interface.js';
import type { TlsStore } from '../../application/ports/driven/tls-store.interface.js';
import type { MaintainInternetAccessUseCase } from '../../application/ports/driving/maintain-internet-access-use-case.interface.js';
import { InternetAccessSetup } from '../../application/services/internet-access-setup.service.js';
import { CheckInternetAccess } from '../../application/use-cases/check-internet-access.usecase.js';
import { MaintainInternetAccess } from '../../application/use-cases/maintain-internet-access.usecase.js';
import { ReadHttpSettings } from '../../application/use-cases/read-http-settings.usecase.js';
import { ReadInternetAccess } from '../../application/use-cases/read-internet-access.usecase.js';
import { ReadKeepAwake } from '../../application/use-cases/read-keep-awake.usecase.js';
import { ReadTlsSettings } from '../../application/use-cases/read-tls-settings.usecase.js';
import { SaveHttpSettings } from '../../application/use-cases/save-http-settings.usecase.js';
import { SaveKeepAwake } from '../../application/use-cases/save-keep-awake.usecase.js';
import { SaveTlsSettings } from '../../application/use-cases/save-tls-settings.usecase.js';
import { SetUpInternetAccess } from '../../application/use-cases/set-up-internet-access.usecase.js';
import { TurnOffInternetAccess } from '../../application/use-cases/turn-off-internet-access.usecase.js';
import { RenewalPolicy } from '../../domain/services/renewal-policy.service.js';
import { InternetAccessUpkeep } from '../adapters/driving/schedule/internet-access-upkeep.adapter.js';
import { InternetAccessController } from '../adapters/driving/web/internet-access.controller.js';
import { KeepAwakeController } from '../adapters/driving/web/keep-awake.controller.js';
import type { RuntimeStatus } from '../adapters/driving/web/settings.controller.js';
import { SettingsController } from '../adapters/driving/web/settings.controller.js';

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

// The driven adapters the server settings feature needs; root composition supplies them.
export interface SettingsAdapters {
    tls: TlsStore;
    certificates: CertificateValidator;
    status: RuntimeStatus;
    http: HttpSettingsStore;
    operations: AuditedOperation;
    internetAccess: InternetAccessStore;
    router: RouterGateway;
    probe: PublicAddressProbe;
    authority: CertificateAuthority;
    https: HttpsRuntime;
    local: LocalAddressReader;
    background: BackgroundTasks;
    keepAwake: KeepAwakeStore;
    keepAwakeRuntime: KeepAwakeRuntime;
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
            router,
            probe,
            authority,
            https,
            local,
            background,
            keepAwake,
            keepAwakeRuntime,
            clock,
        } = adapters;

        return {
            module: SettingsModule,
            controllers: [SettingsController, InternetAccessController, KeepAwakeController],
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
                    useFactory: () => new SaveHttpSettings(http, tls, operations),
                },
                {
                    provide: SERVER_SETTINGS_INTERNET_ACCESS_SETUP,
                    useFactory: () =>
                        new InternetAccessSetup(
                            internetAccess,
                            router,
                            probe,
                            authority,
                            https,
                            tls,
                            clock,
                        ),
                },
                {
                    provide: SERVER_SETTINGS_READ_INTERNET_ACCESS,
                    useFactory: () => new ReadInternetAccess(internetAccess, tls, local),
                },
                {
                    provide: SERVER_SETTINGS_SET_UP_INTERNET_ACCESS,
                    inject: [SERVER_SETTINGS_INTERNET_ACCESS_SETUP],
                    useFactory: (setup: InternetAccessSetup) =>
                        new SetUpInternetAccess(internetAccess, tls, setup, background, operations),
                },
                {
                    provide: SERVER_SETTINGS_CHECK_INTERNET_ACCESS,
                    inject: [SERVER_SETTINGS_INTERNET_ACCESS_SETUP],
                    useFactory: (setup: InternetAccessSetup) =>
                        new CheckInternetAccess(internetAccess, setup, background, operations),
                },
                {
                    provide: SERVER_SETTINGS_TURN_OFF_INTERNET_ACCESS,
                    useFactory: () =>
                        new TurnOffInternetAccess(internetAccess, router, tls, operations),
                },
                {
                    provide: SERVER_SETTINGS_MAINTAIN_INTERNET_ACCESS,
                    inject: [SERVER_SETTINGS_INTERNET_ACCESS_SETUP],
                    useFactory: (setup: InternetAccessSetup) =>
                        new MaintainInternetAccess(
                            internetAccess,
                            router,
                            probe,
                            tls,
                            setup,
                            clock,
                        ),
                },
                {
                    provide: SERVER_SETTINGS_INTERNET_ACCESS_UPKEEP,
                    inject: [SERVER_SETTINGS_MAINTAIN_INTERNET_ACCESS],
                    useFactory: (maintain: MaintainInternetAccessUseCase) =>
                        new InternetAccessUpkeep(maintain, RenewalPolicy.upkeepInterval),
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
}
