import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { CountKeptCoversUseCase } from '../../../../application/ports/driving/count-kept-covers-use-case.interface.js';
import type { ResetApplicationDataUseCase } from '../../../../application/ports/driving/reset-application-data-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { HttpSessions } from '../../../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import type { KeptCoversDto } from '../../../../../../../../packages/contracts/src/http.js';

const dataResetSchema = z.strictObject({
    password: z.string().min(1).max(128),
    deleteKeptCovers: z.boolean().default(false),
});

@Controller('api/maintenance')
export class MaintenanceController {
    constructor(
        @Inject('MAINTENANCE_RESET_DATA') private readonly resetData: ResetApplicationDataUseCase,
        @Inject('MAINTENANCE_COUNT_KEPT_COVERS')
        private readonly countKeptCovers: CountKeptCoversUseCase,
        private readonly sessions: HttpSessions,
    ) {}

    @Get('kept-covers')
    @Access('admin')
    async keptCovers(@Req() request: AuthenticatedRequest): Promise<KeptCoversDto> {
        return { count: await this.countKeptCovers.execute(request.actor) };
    }

    @Post('data-reset')
    @HttpCode(204)
    @Access('admin')
    async reset(
        @Body({ schema: dataResetSchema }) input: z.infer<typeof dataResetSchema>,
        @Req() request: AuthenticatedRequest,
        @Res({ passthrough: true }) response: Response,
    ): Promise<void> {
        await this.resetData.execute(request.actor, input.password, input.deleteKeptCovers);
        this.sessions.clear(request, response);
    }
}
