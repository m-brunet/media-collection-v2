import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import type { z } from 'zod';
import type { FindReceiversUseCase } from '../../../../application/ports/driving/find-receivers-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { ReceiverDto } from '../../../../../../../../packages/contracts/src/http.js';
import { receiverSearchSchema } from './lending-schemas.js';

@Controller('api/receivers')
export class ReceiversController {
    constructor(
        @Inject('LENDING_FIND_RECEIVERS') private readonly findReceivers: FindReceiversUseCase,
    ) {}

    @Get()
    find(
        @Query({ schema: receiverSearchSchema }) query: z.infer<typeof receiverSearchSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<ReceiverDto[]> {
        return this.findReceivers.execute(request.actor, query.search);
    }
}
