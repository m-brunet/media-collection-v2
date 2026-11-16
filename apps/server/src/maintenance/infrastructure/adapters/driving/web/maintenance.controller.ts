import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { CountKeptCoversUseCase } from '../../../../application/ports/driving/count-kept-covers-use-case.interface.js';
import type { DeleteKeptCoversUseCase } from '../../../../application/ports/driving/delete-kept-covers-use-case.interface.js';
import type { GetKeptCoverSummaryUseCase } from '../../../../application/ports/driving/get-kept-cover-summary-use-case.interface.js';
import type { ResetApplicationDataUseCase } from '../../../../application/ports/driving/reset-application-data-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { HttpSessions } from '../../../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import type {
    KeptCoversDeletedDto,
    KeptCoversDto,
    KeptCoverSummaryDto,
} from '../../../../../../../../packages/contracts/src/http.js';

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
        @Inject('MAINTENANCE_GET_KEPT_COVER_SUMMARY')
        private readonly keptCoverSummary: GetKeptCoverSummaryUseCase,
        @Inject('MAINTENANCE_DELETE_KEPT_COVERS')
        private readonly deleteKeptCovers: DeleteKeptCoversUseCase,
        private readonly sessions: HttpSessions,
    ) {}

    @Get('kept-covers')
    @Access('admin')
    async keptCovers(@Req() request: AuthenticatedRequest): Promise<KeptCoversDto> {
        return { count: await this.countKeptCovers.execute(request.actor) };
    }

    @Get('kept-covers/summary')
    @Access('admin')
    summary(@Req() request: AuthenticatedRequest): Promise<KeptCoverSummaryDto> {
        return this.keptCoverSummary.execute(request.actor);
    }

    @Delete('kept-covers')
    @Access('admin')
    async delete(@Req() request: AuthenticatedRequest): Promise<KeptCoversDeletedDto> {
        return { deleted: await this.deleteKeptCovers.execute(request.actor) };
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
