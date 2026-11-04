import { Body, Controller, Get, Inject, Param, Put, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import type { CorrectAuthorUseCase } from '../../../../application/ports/driving/correct-author-use-case.interface.js';
import type { FindAuthorsUseCase } from '../../../../application/ports/driving/find-authors-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { AuthorDto } from '../../../../../../../../packages/contracts/src/http.js';
import { idSchema } from './book-schemas.js';

const searchSchema = z.strictObject({ search: z.string().max(400).default('') });
const correctionSchema = z.strictObject({ name: z.string().max(400) });

@Controller('api/authors')
export class AuthorsController {
    constructor(
        @Inject('BOOKS_FIND_AUTHORS') private readonly findAuthors: FindAuthorsUseCase,
        @Inject('BOOKS_CORRECT_AUTHOR') private readonly correctAuthor: CorrectAuthorUseCase,
    ) {}

    @Get()
    find(
        @Query({ schema: searchSchema }) query: z.infer<typeof searchSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<AuthorDto[]> {
        return this.findAuthors.execute(request.actor, query.search);
    }

    @Put(':id')
    correct(
        @Param('id', { schema: idSchema }) id: string,
        @Body({ schema: correctionSchema }) input: z.infer<typeof correctionSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<AuthorDto> {
        return this.correctAuthor.execute(request.actor, id, input.name);
    }
}
