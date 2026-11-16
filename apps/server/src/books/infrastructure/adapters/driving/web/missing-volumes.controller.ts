import { Body, Controller, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
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
        @Res({ passthrough: true }) response: Response,
    ): Promise<MissingVolumesDto> {
        return this.findMissingVolumes.execute(
            request.actor,
            id,
            input.upTo,
            MissingVolumesController.abandoned(response),
        );
    }

    // Node closes a response when it is fully sent or when its connection is lost; only the
    // second case leaves it unfinished.
    private static abandoned(response: Response): AbortSignal {
        const cancel = new AbortController();

        response.on('close', () => {
            if (!response.writableFinished) {
                cancel.abort();
            }
        });

        return cancel.signal;
    }
}
