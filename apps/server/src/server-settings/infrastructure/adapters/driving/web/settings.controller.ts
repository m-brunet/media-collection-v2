import { Body, Controller, Get, Inject, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import type { ReadTlsSettingsUseCase } from '../../../../application/ports/driving/read-tls-settings-use-case.interface.js';
import type { SaveTlsSettingsUseCase } from '../../../../application/ports/driving/save-tls-settings-use-case.interface.js';
import type { ReadHttpSettingsUseCase } from '../../../../application/ports/driving/read-http-settings-use-case.interface.js';
import type { SaveHttpSettingsUseCase } from '../../../../application/ports/driving/save-http-settings-use-case.interface.js';
import type { ReadInternetAccessUseCase } from '../../../../application/ports/driving/read-internet-access-use-case.interface.js';
import type { ReadKeepAwakeUseCase } from '../../../../application/ports/driving/read-keep-awake-use-case.interface.js';
import type { ReadDomainNameUseCase } from '../../../../application/ports/driving/read-domain-name-use-case.interface.js';
import type { ReadHttpInternetAccessUseCase } from '../../../../application/ports/driving/read-http-internet-access-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { ServerStatus } from '../../../../../../../../packages/contracts/src/http.js';

export interface RuntimeStatus {
    read(): Promise<Pick<ServerStatus, 'running' | 'restartRequired'>>;
}

const settingsSchema = z.strictObject({
    enabled: z.boolean(),
    port: z.number().int().min(1024).max(65535),
    chain: z.string().min(1).max(128000).optional(),
    key: z.string().min(1).max(128000).optional(),
});
const httpSettingsSchema = z.strictObject({
    port: z.number().int().min(1024).max(65535),
});

@Controller('api/server-settings')
@Access('admin')
export class SettingsController {
    constructor(
        @Inject('SERVER_SETTINGS_READ_TLS_SETTINGS') private readonly read: ReadTlsSettingsUseCase,
        @Inject('SERVER_SETTINGS_SAVE_TLS_SETTINGS') private readonly save: SaveTlsSettingsUseCase,
        @Inject('SERVER_SETTINGS_READ_HTTP_SETTINGS')
        private readonly readHttp: ReadHttpSettingsUseCase,
        @Inject('SERVER_SETTINGS_SAVE_HTTP_SETTINGS')
        private readonly saveHttp: SaveHttpSettingsUseCase,
        @Inject('SERVER_SETTINGS_RUNTIME_STATUS') private readonly runtime: RuntimeStatus,
        @Inject('SERVER_SETTINGS_READ_INTERNET_ACCESS')
        private readonly internetAccess: ReadInternetAccessUseCase,
        @Inject('SERVER_SETTINGS_READ_KEEP_AWAKE') private readonly keepAwake: ReadKeepAwakeUseCase,
        @Inject('SERVER_SETTINGS_READ_DOMAIN_NAME')
        private readonly domainName: ReadDomainNameUseCase,
        @Inject('SERVER_SETTINGS_READ_HTTP_INTERNET_ACCESS')
        private readonly httpInternetAccess: ReadHttpInternetAccessUseCase,
    ) {}

    @Get()
    async get(@Req() request: AuthenticatedRequest): Promise<ServerStatus> {
        return this.status(request, {
            http: await this.readHttp.execute(request.actor),
            tls: await this.read.execute(request.actor),
        });
    }

    @Put()
    async update(
        @Body({ schema: settingsSchema }) input: z.infer<typeof settingsSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<ServerStatus> {
        return this.status(request, {
            tls: await this.save.execute(request.actor, input),
            http: await this.readHttp.execute(request.actor),
        });
    }

    @Put('http')
    async updateHttp(
        @Body({ schema: httpSettingsSchema }) input: z.infer<typeof httpSettingsSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<ServerStatus> {
        return this.status(request, {
            http: await this.saveHttp.execute(request.actor, input),
            tls: await this.read.execute(request.actor),
        });
    }

    private async status(
        request: AuthenticatedRequest,
        configured: ServerStatus['configured'],
    ): Promise<ServerStatus> {
        return {
            configured,
            internetAccess: await this.internetAccess.execute(request.actor),
            keepAwake: await this.keepAwake.execute(request.actor),
            domainName: await this.domainName.execute(request.actor),
            httpInternetAccess: await this.httpInternetAccess.execute(request.actor),
            ...(await this.runtime.read()),
        };
    }
}
