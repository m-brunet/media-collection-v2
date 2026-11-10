import { Body, Controller, Get, Inject, Param, Put, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import type { CorrectAuthorUseCase } from '../../../../application/ports/driving/correct-author-use-case.interface.js';
import type { FindAuthorsUseCase } from '../../../../application/ports/driving/find-authors-use-case.interface.js';
import type { NameAuthorsUseCase } from '../../../../application/ports/driving/name-authors-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { AuthorDto } from '../../../../../../../../packages/contracts/src/http.js';
import { idSchema } from './book-schemas.js';

const searchSchema = z.strictObject({ search: z.string().max(400).default('') });
const correctionSchema = z.strictObject({ name: z.string().max(400) });
const idsSchema = z.strictObject({
    id: z.preprocess(
        (value) => (Array.isArray(value) ? value : [value]),
        z.array(idSchema).min(1).max(100),
    ),
});

@Controller('api/authors')
export class AuthorsController {
    constructor(
        @Inject('BOOKS_FIND_AUTHORS') private readonly findAuthors: FindAuthorsUseCase,
        @Inject('BOOKS_NAME_AUTHORS') private readonly nameAuthors: NameAuthorsUseCase,
        @Inject('BOOKS_CORRECT_AUTHOR') private readonly correctAuthor: CorrectAuthorUseCase,
    ) {}

    @Get()
    find(
        @Query({ schema: searchSchema }) query: z.infer<typeof searchSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<AuthorDto[]> {
        return this.findAuthors.execute(request.actor, query.search);
    }

    @Get('by-id')
    named(
        @Query({ schema: idsSchema }) query: z.infer<typeof idsSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<AuthorDto[]> {
        return this.nameAuthors.execute(request.actor, query.id);
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
