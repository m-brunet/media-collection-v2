import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import type { LookUpBookUseCase } from '../../../../application/ports/driving/look-up-book-use-case.interface.js';
import type { ReadLookupCoverUseCase } from '../../../../application/ports/driving/read-lookup-cover-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { BookLookupDto } from '../../../../../../../../packages/contracts/src/http.js';
import { bookLookupSchema, idSchema } from './book-schemas.js';

// Find book for Owners and Admin: the library first, then the outside sources. Nothing is saved
// here; the reviewed book is created with the books endpoints.
@Controller('api/books/lookups')
export class LookupsController {
    constructor(
        @Inject('BOOKS_LOOK_UP') private readonly lookUpBook: LookUpBookUseCase,
        @Inject('BOOKS_READ_LOOKUP_COVER') private readonly readLookupCover: ReadLookupCoverUseCase,
    ) {}

    @Post()
    @HttpCode(200)
    lookUp(
        @Body({ schema: bookLookupSchema }) body: z.infer<typeof bookLookupSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookLookupDto> {
        return this.lookUpBook.execute(request.actor, body.isbn);
    }

    @Get('covers/:token')
    async cover(
        @Param('token', { schema: idSchema }) token: string,
        @Req() request: AuthenticatedRequest,
        @Res() response: Response,
    ): Promise<void> {
        const cover = await this.readLookupCover.execute(request.actor, token);

        response.setHeader('Content-Type', cover.mediaType);
        response.setHeader('Cache-Control', 'private, max-age=1800');
        response.send(Buffer.from(cover.bytes));
    }
}
