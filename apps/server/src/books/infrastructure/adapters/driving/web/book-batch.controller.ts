import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { z } from 'zod';
import type { EditBooksInBatchUseCase } from '../../../../application/ports/driving/edit-books-in-batch-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { BookBatchDto } from '../../../../../../../../packages/contracts/src/http.js';
import { bookBatchSchema } from './book-schemas.js';

@Controller('api/books/batch-edit')
export class BookBatchController {
    constructor(
        @Inject('BOOKS_EDIT_IN_BATCH') private readonly editInBatch: EditBooksInBatchUseCase,
    ) {}

    @Post()
    @HttpCode(200)
    edit(
        @Body({ schema: bookBatchSchema }) input: z.infer<typeof bookBatchSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookBatchDto> {
        return this.editInBatch.execute(request.actor, input);
    }
}
