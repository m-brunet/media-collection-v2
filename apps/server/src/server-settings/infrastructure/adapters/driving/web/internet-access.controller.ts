import { Body, Controller, Delete, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { CheckInternetAccessUseCase } from '../../../../application/ports/driving/check-internet-access-use-case.interface.js';
import type { ReadInternetAccessUseCase } from '../../../../application/ports/driving/read-internet-access-use-case.interface.js';
import type { SetUpInternetAccessUseCase } from '../../../../application/ports/driving/set-up-internet-access-use-case.interface.js';
import type { TurnOffInternetAccessUseCase } from '../../../../application/ports/driving/turn-off-internet-access-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { InternetAccessStatus } from '../../../../../../../../packages/contracts/src/http.js';

const setUpSchema = z.strictObject({
    replaceCertificate: z.boolean().optional(),
    // Checked by the domain (`domain-name-invalid`); blank or null means no domain name.
    domain: z.string().max(260).nullable().optional(),
});

// The setup and the check answer at once (202); the page follows the steps with the settings.
@Controller('api/server-settings/internet-access')
@Access('admin')
export class InternetAccessController {
    constructor(
        @Inject('SERVER_SETTINGS_SET_UP_INTERNET_ACCESS')
        private readonly setUp: SetUpInternetAccessUseCase,
        @Inject('SERVER_SETTINGS_CHECK_INTERNET_ACCESS')
        private readonly check: CheckInternetAccessUseCase,
        @Inject('SERVER_SETTINGS_TURN_OFF_INTERNET_ACCESS')
        private readonly turnOff: TurnOffInternetAccessUseCase,
        @Inject('SERVER_SETTINGS_READ_INTERNET_ACCESS')
        private readonly read: ReadInternetAccessUseCase,
    ) {}

    @Post()
    @HttpCode(202)
    async start(
        @Body({ schema: setUpSchema }) input: z.infer<typeof setUpSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<InternetAccessStatus> {
        await this.setUp.execute(request.actor, {
            replaceCertificate: input.replaceCertificate ?? false,
            domain: input.domain ?? null,
        });

        return this.read.execute(request.actor);
    }

    @Post('check')
    @HttpCode(202)
    async recheck(@Req() request: AuthenticatedRequest): Promise<InternetAccessStatus> {
        await this.check.execute(request.actor);

        return this.read.execute(request.actor);
    }

    @Delete()
    async stop(@Req() request: AuthenticatedRequest): Promise<InternetAccessStatus> {
        await this.turnOff.execute(request.actor);

        return this.read.execute(request.actor);
    }
}
