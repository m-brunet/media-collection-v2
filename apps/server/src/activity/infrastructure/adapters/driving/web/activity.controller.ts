import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import type { z } from 'zod';
import type { ActivityCursor } from '../../../../application/activity-page.js';
import type { ListActivityUseCase } from '../../../../application/ports/driving/list-activity-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { ActivityPageDto } from '../../../../../../../../packages/contracts/src/http.js';
import { activityQuerySchema } from './activity-schemas.js';

@Controller('api/activity')
export class ActivityController {
    constructor(@Inject('ACTIVITY_LIST') private readonly listActivity: ListActivityUseCase) {}

    @Get()
    async list(
        @Query({ schema: activityQuerySchema }) query: z.infer<typeof activityQuerySchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<ActivityPageDto> {
        const page = await this.listActivity.execute(request.actor, query.before ?? null);

        return { entries: page.entries, older: page.older ? this.cursor(page.older) : null };
    }

    private cursor(older: ActivityCursor): string {
        return older.occurredAt + '_' + older.operationId;
    }
}
