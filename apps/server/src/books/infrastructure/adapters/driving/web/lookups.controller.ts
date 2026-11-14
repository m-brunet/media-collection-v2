import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import type { LookUpBookUseCase } from '../../../../application/ports/driving/look-up-book-use-case.interface.js';
import type { ReadLookupCoverUseCase } from '../../../../application/ports/driving/read-lookup-cover-use-case.interface.js';
import type { FetchCoverFromAddressUseCase } from '../../../../application/ports/driving/fetch-cover-from-address-use-case.interface.js';
import type { CoverImage } from '../../../../domain/value-objects/cover-image.value-object.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type {
    BookLookupDto,
    VolumeCoverDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import type { FindVolumeCoverUseCase } from '../../../../application/ports/driving/find-volume-cover-use-case.interface.js';
import { bookLookupSchema, coverAddressSchema, idSchema } from './book-schemas.js';

@Controller('api/books/lookups')
export class LookupsController {
    constructor(
        @Inject('BOOKS_LOOK_UP') private readonly lookUpBook: LookUpBookUseCase,
        @Inject('BOOKS_READ_LOOKUP_COVER') private readonly readLookupCover: ReadLookupCoverUseCase,
        @Inject('BOOKS_FETCH_COVER_FROM_ADDRESS')
        private readonly fetchCoverFromAddress: FetchCoverFromAddressUseCase,
        @Inject('BOOKS_FIND_VOLUME_COVER') private readonly findVolumeCover: FindVolumeCoverUseCase,
    ) {}

    @Post()
    @HttpCode(200)
    lookUp(
        @Body({ schema: bookLookupSchema }) body: z.infer<typeof bookLookupSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookLookupDto> {
        return this.lookUpBook.execute(request.actor, body.isbn);
    }

    @Post('volume-cover')
    @HttpCode(200)
    volumeCover(
        @Body({ schema: bookLookupSchema }) body: z.infer<typeof bookLookupSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<VolumeCoverDto> {
        return this.findVolumeCover.execute(request.actor, body.isbn);
    }

    @Get('covers/:token')
    async cover(
        @Param('token', { schema: idSchema }) token: string,
        @Req() request: AuthenticatedRequest,
        @Res() response: Response,
    ): Promise<void> {
        LookupsController.send(
            response,
            await this.readLookupCover.execute(request.actor, token),
            'private, max-age=1800',
        );
    }

    @Post('covers')
    @HttpCode(200)
    async fromAddress(
        @Body({ schema: coverAddressSchema }) body: z.infer<typeof coverAddressSchema>,
        @Req() request: AuthenticatedRequest,
        @Res() response: Response,
    ): Promise<void> {
        LookupsController.send(
            response,
            await this.fetchCoverFromAddress.execute(request.actor, body.address),
            'no-store',
        );
    }

    private static send(response: Response, cover: CoverImage, cacheControl: string): void {
        response.setHeader('Content-Type', cover.mediaType);
        response.setHeader('Cache-Control', cacheControl);
        response.send(Buffer.from(cover.bytes));
    }
}
