import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { CertificateValidator } from '../../application/ports/driven/certificate-validator.interface.js';
import type { TlsStore } from '../../application/ports/driven/tls-store.interface.js';
import type { HttpSettingsStore } from '../../application/ports/driven/http-settings-store.interface.js';
import { ReadHttpSettings } from '../../application/use-cases/read-http-settings.usecase.js';
import { SaveHttpSettings } from '../../application/use-cases/save-http-settings.usecase.js';
import { ReadTlsSettings } from '../../application/use-cases/read-tls-settings.usecase.js';
import { SaveTlsSettings } from '../../application/use-cases/save-tls-settings.usecase.js';
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

@Module({})
export class SettingsModule {
    static register(
        store: TlsStore,
        certificates: CertificateValidator,
        status: RuntimeStatus,
        http: HttpSettingsStore,
    ): DynamicModule {
        return {
            module: SettingsModule,
            controllers: [SettingsController],
            providers: [
                { provide: SERVER_SETTINGS_TLS_STORE, useValue: store },
                { provide: SERVER_SETTINGS_CERTIFICATE_VALIDATOR, useValue: certificates },
                { provide: SERVER_SETTINGS_RUNTIME_STATUS, useValue: status },
                { provide: SERVER_SETTINGS_HTTP_SETTINGS_STORE, useValue: http },
                {
                    provide: SERVER_SETTINGS_READ_TLS_SETTINGS,
                    inject: [SERVER_SETTINGS_TLS_STORE],
                    useFactory: (store: TlsStore) => new ReadTlsSettings(store),
                },
                {
                    provide: SERVER_SETTINGS_SAVE_TLS_SETTINGS,
                    inject: [
                        SERVER_SETTINGS_TLS_STORE,
                        SERVER_SETTINGS_CERTIFICATE_VALIDATOR,
                        SERVER_SETTINGS_HTTP_SETTINGS_STORE,
                    ],
                    useFactory: (
                        store: TlsStore,
                        certificates: CertificateValidator,
                        http: HttpSettingsStore,
                    ) => new SaveTlsSettings(store, certificates, http),
                },
                {
                    provide: SERVER_SETTINGS_READ_HTTP_SETTINGS,
                    inject: [SERVER_SETTINGS_HTTP_SETTINGS_STORE],
                    useFactory: (http: HttpSettingsStore) => new ReadHttpSettings(http),
                },
                {
                    provide: SERVER_SETTINGS_SAVE_HTTP_SETTINGS,
                    inject: [SERVER_SETTINGS_HTTP_SETTINGS_STORE, SERVER_SETTINGS_TLS_STORE],
                    useFactory: (http: HttpSettingsStore, store: TlsStore) =>
                        new SaveHttpSettings(http, store),
                },
            ],
        };
    }
}
