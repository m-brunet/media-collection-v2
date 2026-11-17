import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import type { FindPublishersUseCase } from '../../../../application/ports/driving/find-publishers-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';

const searchSchema = z.strictObject({ search: z.string().max(400).default('') });

@Controller('api/publishers')
export class PublishersController {
    constructor(
        @Inject('BOOKS_FIND_PUBLISHERS') private readonly findPublishers: FindPublishersUseCase,
    ) {}

    @Get()
    find(
        @Query({ schema: searchSchema }) query: z.infer<typeof searchSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<string[]> {
        return this.findPublishers.execute(request.actor, query.search);
    }
}
