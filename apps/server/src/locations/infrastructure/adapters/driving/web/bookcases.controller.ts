import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Inject,
    Param,
    Patch,
    Post,
    Req,
} from '@nestjs/common';
import type { z } from 'zod';
import type { CreateBookcaseUseCase } from '../../../../application/ports/driving/create-bookcase-use-case.interface.js';
import type { CreateShelfUseCase } from '../../../../application/ports/driving/create-shelf-use-case.interface.js';
import type { DeleteBookcaseUseCase } from '../../../../application/ports/driving/delete-bookcase-use-case.interface.js';
import type { ListBookcasesUseCase } from '../../../../application/ports/driving/list-bookcases-use-case.interface.js';
import type { RenameBookcaseUseCase } from '../../../../application/ports/driving/rename-bookcase-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { BookcaseDto, ShelfDto } from '../../../../../../../../packages/contracts/src/http.js';
import { locationIdSchema, locationNameSchema } from './location-schemas.js';

// Bookcases and the shelves created inside them: every signed-in account reads them, Owners
// manage them.
@Controller('api/bookcases')
export class BookcasesController {
    constructor(
        @Inject('LOCATIONS_LIST') private readonly listBookcases: ListBookcasesUseCase,
        @Inject('LOCATIONS_CREATE_BOOKCASE') private readonly createBookcase: CreateBookcaseUseCase,
        @Inject('LOCATIONS_RENAME_BOOKCASE') private readonly renameBookcase: RenameBookcaseUseCase,
        @Inject('LOCATIONS_DELETE_BOOKCASE') private readonly deleteBookcase: DeleteBookcaseUseCase,
        @Inject('LOCATIONS_CREATE_SHELF') private readonly createShelf: CreateShelfUseCase,
    ) {}

    @Get()
    list(@Req() request: AuthenticatedRequest): Promise<BookcaseDto[]> {
        return this.listBookcases.execute(request.actor);
    }

    @Post()
    create(
        @Body({ schema: locationNameSchema }) body: z.infer<typeof locationNameSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookcaseDto> {
        return this.createBookcase.execute(request.actor, body.name);
    }

    @Patch(':id')
    rename(
        @Param('id', { schema: locationIdSchema }) id: string,
        @Body({ schema: locationNameSchema }) body: z.infer<typeof locationNameSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookcaseDto> {
        return this.renameBookcase.execute(request.actor, id, body.name);
    }

    @Delete(':id')
    @HttpCode(204)
    async delete(
        @Param('id', { schema: locationIdSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<void> {
        await this.deleteBookcase.execute(request.actor, id);
    }

    @Post(':id/shelves')
    addShelf(
        @Param('id', { schema: locationIdSchema }) id: string,
        @Body({ schema: locationNameSchema }) body: z.infer<typeof locationNameSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<ShelfDto> {
        return this.createShelf.execute(request.actor, id, body.name);
    }
}
