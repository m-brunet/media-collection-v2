import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import type { z } from 'zod';
import type { AddVolumesUseCase } from '../../../../application/ports/driving/add-volumes-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { VolumesAddedDto } from '../../../../../../../../packages/contracts/src/http.js';
import { addVolumesSchema } from './book-schemas.js';

@Controller('api/books/volumes')
export class VolumesController {
    constructor(@Inject('BOOKS_ADD_VOLUMES') private readonly addVolumes: AddVolumesUseCase) {}

    @Post()
    add(
        @Body({ schema: addVolumesSchema }) input: z.infer<typeof addVolumesSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<VolumesAddedDto> {
        return this.addVolumes.execute(request.actor, input);
    }
}
