import { Body, Controller, Delete, HttpCode, Inject, Param, Patch, Req } from '@nestjs/common';
import type { z } from 'zod';
import type { ChangeShelfUseCase } from '../../../../application/ports/driving/change-shelf-use-case.interface.js';
import type { DeleteShelfUseCase } from '../../../../application/ports/driving/delete-shelf-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { ShelfDto } from '../../../../../../../../packages/contracts/src/http.js';
import { locationIdSchema, shelfChangesSchema } from './location-schemas.js';

// Shelves Owners rename, move to another bookcase or delete; their books are always kept.
@Controller('api/shelves')
export class ShelvesController {
    constructor(
        @Inject('LOCATIONS_CHANGE_SHELF') private readonly changeShelf: ChangeShelfUseCase,
        @Inject('LOCATIONS_DELETE_SHELF') private readonly deleteShelf: DeleteShelfUseCase,
    ) {}

    @Patch(':id')
    change(
        @Param('id', { schema: locationIdSchema }) id: string,
        @Body({ schema: shelfChangesSchema }) changes: z.infer<typeof shelfChangesSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<ShelfDto> {
        return this.changeShelf.execute(request.actor, id, changes);
    }

    @Delete(':id')
    @HttpCode(204)
    async delete(
        @Param('id', { schema: locationIdSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<void> {
        await this.deleteShelf.execute(request.actor, id);
    }
}
