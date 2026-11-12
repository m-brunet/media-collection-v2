import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { CreatePairingCodeUseCase } from '../../../../application/ports/driving/create-pairing-code-use-case.interface.js';
import type { RedeemPairingCodeUseCase } from '../../../../application/ports/driving/redeem-pairing-code-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { HttpSessions } from '../../../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { LoginLimiter } from '../../../../../shared/infrastructure/adapters/driving/web/login-limiter.service.js';
import type { Account, PairingLink } from '../../../../../../../../packages/contracts/src/http.js';

const codeRequestSchema = z.strictObject({
    address: z.string().min(1).max(300),
});
const pairSchema = z.strictObject({
    code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

@Controller('api/auth')
export class PairingController {
    constructor(
        @Inject('IDENTITY_CREATE_PAIRING_CODE') private readonly create: CreatePairingCodeUseCase,
        @Inject('IDENTITY_REDEEM_PAIRING_CODE') private readonly redeem: RedeemPairingCodeUseCase,
        private readonly sessions: HttpSessions,
        private readonly limiter: LoginLimiter,
    ) {}

    @Post('pairing-codes')
    @Access('admin')
    async createCode(
        @Body({ schema: codeRequestSchema }) input: z.infer<typeof codeRequestSchema>,
        @Req() request: AuthenticatedRequest,
        @Res({ passthrough: true }) response: Response,
    ): Promise<PairingLink> {
        response.setHeader('Cache-Control', 'no-store');

        return this.create.execute(request.actor, input.address);
    }

    @Post('pair')
    @HttpCode(200)
    @Access('public')
    async pair(
        @Body({ schema: pairSchema }) input: z.infer<typeof pairSchema>,
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ): Promise<Account> {
        this.limiter.check(request);
        const result = await this.redeem.execute(input.code);
        const { id, username, role, mustChangePassword, language } = result.actor;

        this.sessions.set(request, response, result.token);

        return { id, username, role, mustChangePassword, language };
    }
}
