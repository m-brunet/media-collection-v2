import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { z } from 'zod';
import type { PlaceBooksOnShelfUseCase } from '../../../../application/ports/driving/place-books-on-shelf-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { ShelfPlacementDto } from '../../../../../../../../packages/contracts/src/http.js';
import { shelfPlacementSchema } from './book-schemas.js';

@Controller('api/books/shelf-placement')
export class ShelfPlacementController {
    constructor(
        @Inject('BOOKS_PLACE_ON_SHELF') private readonly placeOnShelf: PlaceBooksOnShelfUseCase,
    ) {}

    @Post()
    @HttpCode(200)
    place(
        @Body({ schema: shelfPlacementSchema }) input: z.infer<typeof shelfPlacementSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<ShelfPlacementDto> {
        return this.placeOnShelf.execute(request.actor, input);
    }
}
