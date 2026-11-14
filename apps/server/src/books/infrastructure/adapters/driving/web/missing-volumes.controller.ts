import { Body, Controller, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import type { z } from 'zod';
import type { FindMissingVolumesUseCase } from '../../../../application/ports/driving/find-missing-volumes-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { MissingVolumesDto } from '../../../../../../../../packages/contracts/src/http.js';
import { idSchema, missingVolumesSearchSchema } from './book-schemas.js';

@Controller('api/collections/:id/missing-volumes')
export class MissingVolumesController {
    constructor(
        @Inject('BOOKS_FIND_MISSING_VOLUMES')
        private readonly findMissingVolumes: FindMissingVolumesUseCase,
    ) {}

    @Post('search')
    @HttpCode(200)
    search(
        @Param('id', { schema: idSchema }) id: string,
        @Body({ schema: missingVolumesSearchSchema })
        input: z.infer<typeof missingVolumesSearchSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<MissingVolumesDto> {
        return this.findMissingVolumes.execute(request.actor, id, input.upTo);
    }
}
