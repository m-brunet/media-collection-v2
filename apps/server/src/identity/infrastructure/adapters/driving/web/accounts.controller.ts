import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { CreateUserUseCase } from '../../../../application/ports/driving/create-user-use-case.interface.js';
import type { DeactivateAccountUseCase } from '../../../../application/ports/driving/deactivate-account-use-case.interface.js';
import type { ListUsersUseCase } from '../../../../application/ports/driving/list-users-use-case.interface.js';
import type { ReactivateAccountUseCase } from '../../../../application/ports/driving/reactivate-account-use-case.interface.js';
import type { ResetPasswordUseCase } from '../../../../application/ports/driving/reset-password-use-case.interface.js';
import type { AccountSummary } from '../../../../domain/entities/user.entity.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { AccountSummary as AccountSummaryDto } from '../../../../../../../../packages/contracts/src/http.js';
import { idSchema } from '../../../../../shared/infrastructure/adapters/driving/web/id-schema.js';

const createSchema = z.strictObject({
    username: z.string().min(3).max(40),
    password: z.string().min(8).max(128),
    role: z.enum(['owner', 'guest']),
});
const resetSchema = z.strictObject({
    password: z.string().min(8).max(128),
});

@Controller('api/users')
export class AccountsController {
    constructor(
        @Inject('IDENTITY_LIST_USERS') private readonly listUsers: ListUsersUseCase,
        @Inject('IDENTITY_CREATE_USER') private readonly createUser: CreateUserUseCase,
        @Inject('IDENTITY_RESET_PASSWORD') private readonly resetPassword: ResetPasswordUseCase,
        @Inject('IDENTITY_DEACTIVATE_ACCOUNT')
        private readonly deactivateAccount: DeactivateAccountUseCase,
        @Inject('IDENTITY_REACTIVATE_ACCOUNT')
        private readonly reactivateAccount: ReactivateAccountUseCase,
    ) {}

    @Get()
    @Access('admin')
    async list(@Req() request: AuthenticatedRequest): Promise<AccountSummaryDto[]> {
        return (await this.listUsers.execute(request.actor)).map((account) => this.dto(account));
    }

    @Post()
    @Access('admin')
    async create(
        @Body({ schema: createSchema }) input: z.infer<typeof createSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<AccountSummaryDto> {
        return this.dto(await this.createUser.execute(request.actor, input));
    }

    @Post(':id/password-reset')
    @HttpCode(200)
    @Access('admin')
    async reset(
        @Param('id', { schema: idSchema }) id: string,
        @Body({ schema: resetSchema }) input: z.infer<typeof resetSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<AccountSummaryDto> {
        return this.dto(await this.resetPassword.execute(request.actor, id, input.password));
    }

    @Post(':id/deactivation')
    @HttpCode(200)
    @Access('admin')
    async deactivate(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<AccountSummaryDto> {
        return this.dto(await this.deactivateAccount.execute(request.actor, id));
    }

    @Post(':id/reactivation')
    @HttpCode(200)
    @Access('admin')
    async reactivate(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<AccountSummaryDto> {
        return this.dto(await this.reactivateAccount.execute(request.actor, id));
    }

    private dto(account: AccountSummary): AccountSummaryDto {
        const { id, username, role, mustChangePassword, active } = account;

        return { id, username, role, mustChangePassword, active };
    }
}
