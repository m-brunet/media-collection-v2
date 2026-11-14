import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import type { z } from 'zod';
import type { GetStatisticsUseCase } from '../../../../application/ports/driving/get-statistics-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { StatisticsDto } from '../../../../../../../../packages/contracts/src/http.js';
import { statisticsQuerySchema } from './statistics-schemas.js';

@Controller('api/statistics')
export class StatisticsController {
    constructor(@Inject('STATISTICS_GET') private readonly getStatistics: GetStatisticsUseCase) {}

    @Get()
    read(
        @Query({ schema: statisticsQuerySchema }) query: z.infer<typeof statisticsQuerySchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<StatisticsDto> {
        return this.getStatistics.execute(request.actor, query.category ?? null);
    }
}
