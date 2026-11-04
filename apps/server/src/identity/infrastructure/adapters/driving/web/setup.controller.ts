import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { CompleteSetupUseCase } from '../../../../application/ports/driving/complete-setup-use-case.interface.js';
import type { SetupStatusUseCase } from '../../../../application/ports/driving/setup-status-use-case.interface.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { HttpSessions } from '../../../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';
import type { Account, SetupStatus } from '../../../../../../../../packages/contracts/src/http.js';
import { SetupAccess } from './setup-access.service.js';

const setupSchema = z.strictObject({
    username: z.string().min(3).max(40),
    password: z.string().min(8).max(128),
});

// First-launch creation of the protected administrator. Accepted only from the Media Collection
// desktop window, so nobody else (another device, or a browser on the same computer) can claim
// the library before its owner.
@Controller('api/setup')
export class SetupController {
    constructor(
        @Inject('IDENTITY_SETUP_STATUS') private readonly status: SetupStatusUseCase,
        @Inject('IDENTITY_COMPLETE_SETUP') private readonly setup: CompleteSetupUseCase,
        private readonly sessions: HttpSessions,
        private readonly access: SetupAccess,
    ) {}

    @Get()
    @Access('public')
    async read(@Req() request: Request): Promise<SetupStatus> {
        const { required } = await this.status.execute();

        return { required, allowed: this.access.allows(request) };
    }

    @Post()
    @HttpCode(201)
    @Access('public')
    async complete(
        @Body({ schema: setupSchema }) input: z.infer<typeof setupSchema>,
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ): Promise<Account> {
        if (!this.access.allows(request)) {
            throw new Failure(
                'forbidden',
                'Finish setup in the Media Collection desktop window.',
                'setup-desktop-only',
            );
        }

        const result = await this.setup.execute(input);

        this.sessions.set(request, response, result.token);
        const { id, username, role, mustChangePassword, language } = result.actor;

        return { id, username, role, mustChangePassword, language };
    }
}
