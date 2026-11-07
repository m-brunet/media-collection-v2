import { Controller, Get, Inject, Req } from '@nestjs/common';
import type { GetOverviewUseCase } from '../../../../application/ports/driving/get-overview-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { OverviewDto } from '../../../../../../../../packages/contracts/src/http.js';

// The Overview every signed-in account reads; the reading part is the viewer's own.
@Controller('api/overview')
export class OverviewController {
    constructor(@Inject('OVERVIEW_GET') private readonly getOverview: GetOverviewUseCase) {}

    @Get()
    read(@Req() request: AuthenticatedRequest): Promise<OverviewDto> {
        return this.getOverview.execute(request.actor);
    }
}
