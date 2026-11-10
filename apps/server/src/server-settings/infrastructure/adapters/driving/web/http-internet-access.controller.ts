import { Controller, Delete, Inject, Post, Req } from '@nestjs/common';
import type { CloseHttpInternetAccessUseCase } from '../../../../application/ports/driving/close-http-internet-access-use-case.interface.js';
import type { OpenHttpInternetAccessUseCase } from '../../../../application/ports/driving/open-http-internet-access-use-case.interface.js';
import type { ReadHttpInternetAccessUseCase } from '../../../../application/ports/driving/read-http-internet-access-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { HttpInternetAccessStatus } from '../../../../../../../../packages/contracts/src/http.js';

@Controller('api/server-settings/internet-access/http')
@Access('admin')
export class HttpInternetAccessController {
    constructor(
        @Inject('SERVER_SETTINGS_OPEN_HTTP_INTERNET_ACCESS')
        private readonly open: OpenHttpInternetAccessUseCase,
        @Inject('SERVER_SETTINGS_CLOSE_HTTP_INTERNET_ACCESS')
        private readonly close: CloseHttpInternetAccessUseCase,
        @Inject('SERVER_SETTINGS_READ_HTTP_INTERNET_ACCESS')
        private readonly read: ReadHttpInternetAccessUseCase,
    ) {}

    @Post()
    async start(@Req() request: AuthenticatedRequest): Promise<HttpInternetAccessStatus> {
        await this.open.execute(request.actor);

        return this.read.execute(request.actor);
    }

    @Delete()
    async stop(@Req() request: AuthenticatedRequest): Promise<HttpInternetAccessStatus> {
        await this.close.execute(request.actor);

        return this.read.execute(request.actor);
    }
}
