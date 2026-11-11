import { Controller, Delete, Get, Inject, Param, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ReadCoverUseCase } from '../../../../application/ports/driving/read-cover-use-case.interface.js';
import type { RemoveCoverUseCase } from '../../../../application/ports/driving/remove-cover-use-case.interface.js';
import type { ReplaceCoverUseCase } from '../../../../application/ports/driving/replace-cover-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { BookDto } from '../../../../../../../../packages/contracts/src/http.js';
import { idSchema } from './book-schemas.js';

@Controller('api/books/:id/cover')
export class CoversController {
    constructor(
        @Inject('BOOKS_READ_COVER') private readonly readCover: ReadCoverUseCase,
        @Inject('BOOKS_REPLACE_COVER') private readonly replaceCover: ReplaceCoverUseCase,
        @Inject('BOOKS_REMOVE_COVER') private readonly removeCover: RemoveCoverUseCase,
    ) {}

    @Get()
    async read(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
        @Res() response: Response,
    ): Promise<void> {
        const cover = await this.readCover.execute(request.actor, id);

        response.setHeader('Content-Type', cover.mediaType);
        response.setHeader('Cache-Control', 'private, no-cache');
        response.send(Buffer.from(cover.bytes));
    }

    @Put()
    replace(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookDto> {
        return this.replaceCover.execute(request.actor, id, CoversController.bytes(request));
    }

    @Delete()
    remove(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<BookDto> {
        return this.removeCover.execute(request.actor, id);
    }

    private static bytes(request: Request): Uint8Array {
        return Buffer.isBuffer(request.body) ? new Uint8Array(request.body) : new Uint8Array();
    }
}
