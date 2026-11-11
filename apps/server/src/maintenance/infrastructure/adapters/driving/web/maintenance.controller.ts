import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { ResetApplicationDataUseCase } from '../../../../application/ports/driving/reset-application-data-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { HttpSessions } from '../../../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';

const dataResetSchema = z.strictObject({
    password: z.string().min(1).max(128),
});

@Controller('api/maintenance')
export class MaintenanceController {
    constructor(
        @Inject('MAINTENANCE_RESET_DATA') private readonly resetData: ResetApplicationDataUseCase,
        private readonly sessions: HttpSessions,
    ) {}

    @Post('data-reset')
    @HttpCode(204)
    @Access('admin')
    async reset(
        @Body({ schema: dataResetSchema }) input: z.infer<typeof dataResetSchema>,
        @Req() request: AuthenticatedRequest,
        @Res({ passthrough: true }) response: Response,
    ): Promise<void> {
        await this.resetData.execute(request.actor, input.password);
        this.sessions.clear(request, response);
    }
}
