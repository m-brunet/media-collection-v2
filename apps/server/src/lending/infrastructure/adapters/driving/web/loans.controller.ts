import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import type { z } from 'zod';
import type { LendBooksUseCase } from '../../../../application/ports/driving/lend-books-use-case.interface.js';
import type { ListActiveLoansUseCase } from '../../../../application/ports/driving/list-active-loans-use-case.interface.js';
import type { RecordReturnsUseCase } from '../../../../application/ports/driving/record-returns-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type {
    LendingDto,
    ReceiverLoansDto,
    ReturnDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import { activeLoansSchema, lendBooksSchema, recordReturnsSchema } from './lending-schemas.js';

// Lending books and recording their return. Everyone signed in sees active loans; Owners and the
// administrator lend and record returns.
@Controller('api/loans')
export class LoansController {
    constructor(
        @Inject('LENDING_LIST_ACTIVE') private readonly listActive: ListActiveLoansUseCase,
        @Inject('LENDING_LEND') private readonly lendBooks: LendBooksUseCase,
        @Inject('LENDING_RECORD_RETURNS') private readonly recordReturns: RecordReturnsUseCase,
    ) {}

    @Get()
    list(
        @Query({ schema: activeLoansSchema }) query: z.infer<typeof activeLoansSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<ReceiverLoansDto[]> {
        return this.listActive.execute(request.actor, {
            search: query.search.trim() === '' ? null : query.search,
            receiverId: query.receiver ?? null,
        });
    }

    @Post()
    lend(
        @Body({ schema: lendBooksSchema }) body: z.infer<typeof lendBooksSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<LendingDto> {
        return this.lendBooks.execute(request.actor, body);
    }

    @Post('returns')
    @HttpCode(200)
    returns(
        @Body({ schema: recordReturnsSchema }) body: z.infer<typeof recordReturnsSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<ReturnDto> {
        return this.recordReturns.execute(request.actor, body.loanIds);
    }
}
