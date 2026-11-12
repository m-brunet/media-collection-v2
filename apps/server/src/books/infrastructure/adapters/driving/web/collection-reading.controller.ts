import { Body, Controller, Get, Inject, Param, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import type { GetCollectionReadingUseCase } from '../../../../application/ports/driving/get-collection-reading-use-case.interface.js';
import type { SetCollectionReadingUseCase } from '../../../../application/ports/driving/set-collection-reading-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { CollectionReadingDto } from '../../../../../../../../packages/contracts/src/http.js';
import { idSchema } from './book-schemas.js';

const readingSchema = z.strictObject({ read: z.boolean() });

@Controller('api/collections/:id/reading')
export class CollectionReadingController {
    constructor(
        @Inject('BOOKS_GET_COLLECTION_READING')
        private readonly getReading: GetCollectionReadingUseCase,
        @Inject('BOOKS_SET_COLLECTION_READING')
        private readonly setReading: SetCollectionReadingUseCase,
    ) {}

    @Get()
    reading(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<CollectionReadingDto> {
        return this.getReading.execute(request.actor, id);
    }

    @Put()
    change(
        @Param('id', { schema: idSchema }) id: string,
        @Body({ schema: readingSchema }) input: z.infer<typeof readingSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<CollectionReadingDto> {
        return this.setReading.execute(request.actor, id, input.read);
    }
}
