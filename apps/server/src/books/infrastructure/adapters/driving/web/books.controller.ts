import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Inject,
    Param,
    Post,
    Put,
    Query,
    Req,
} from '@nestjs/common';
import type { z } from 'zod';
import type { CreateBookUseCase } from '../../../../application/ports/driving/create-book-use-case.interface.js';
import type { DeleteBookUseCase } from '../../../../application/ports/driving/delete-book-use-case.interface.js';
import type { GetBookUseCase } from '../../../../application/ports/driving/get-book-use-case.interface.js';
import type { ListBooksUseCase } from '../../../../application/ports/driving/list-books-use-case.interface.js';
import type { UpdateBookUseCase } from '../../../../application/ports/driving/update-book-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type {
    BookDto,
    BookListPageDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { bookInputSchema, bookListSchema, idSchema, newBookSchema } from './book-schemas.js';

// The shared book records every signed-in account may read and Owners may change.
@Controller('api/books')
export class BooksController {
    constructor(
        @Inject('BOOKS_LIST') private readonly listBooks: ListBooksUseCase,
        @Inject('BOOKS_GET') private readonly getBook: GetBookUseCase,
        @Inject('BOOKS_CREATE') private readonly createBook: CreateBookUseCase,
        @Inject('BOOKS_UPDATE') private readonly updateBook: UpdateBookUseCase,
        @Inject('BOOKS_DELETE') private readonly deleteBook: DeleteBookUseCase,
    ) {}

    @Get()
    list(
        @Query({ schema: bookListSchema }) query: z.infer<typeof bookListSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookListPageDto> {
        return this.listBooks.execute(request.actor, query);
    }

    @Get(':id')
    get(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookDto> {
        return this.getBook.execute(request.actor, id);
    }

    @Post()
    create(
        @Body({ schema: newBookSchema }) input: z.infer<typeof newBookSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookDto> {
        const { read, ...book } = input;

        return this.createBook.execute(request.actor, book, read);
    }

    @Put(':id')
    update(
        @Param('id', { schema: idSchema }) id: string,
        @Body({ schema: bookInputSchema }) input: z.infer<typeof bookInputSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookDto> {
        return this.updateBook.execute(request.actor, id, input);
    }

    @Delete(':id')
    @HttpCode(204)
    async delete(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<void> {
        await this.deleteBook.execute(request.actor, id);
    }
}
