import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { ChangeLanguageUseCase } from '../../../../application/ports/driving/change-language-use-case.interface.js';
import type { ChangePasswordUseCase } from '../../../../application/ports/driving/change-password-use-case.interface.js';
import type { ChangeUsernameUseCase } from '../../../../application/ports/driving/change-username-use-case.interface.js';
import type { LoginUseCase } from '../../../../application/ports/driving/login-use-case.interface.js';
import type { SessionRenewal } from '../../../../../shared/application/ports/driving/session-renewal.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { Access } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { HttpSessions } from '../../../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { LoginLimiter } from '../../../../../shared/infrastructure/adapters/driving/web/login-limiter.service.js';
import type { Actor } from '../../../../../shared/domain/actor.helper.js';
import type { Account } from '../../../../../../../../packages/contracts/src/http.js';

const loginSchema = z.strictObject({
    username: z.string().min(1).max(40),
    password: z.string().min(1).max(128),
});
const usernameSchema = z.strictObject({
    username: z.string().min(3).max(40),
    currentPassword: z.string().min(1).max(128),
});
const passwordSchema = z.strictObject({
    currentPassword: z.string().min(1).max(128),
    password: z.string().min(8).max(128),
});
const languageSchema = z.strictObject({
    language: z.enum(['en', 'fr']),
});

@Controller('api')
export class IdentityController {
    constructor(
        @Inject('IDENTITY_LOGIN') private readonly login: LoginUseCase,
        @Inject('IDENTITY_CHANGE_USERNAME') private readonly changeUsername: ChangeUsernameUseCase,
        @Inject('IDENTITY_CHANGE_PASSWORD') private readonly changePassword: ChangePasswordUseCase,
        @Inject('IDENTITY_CHANGE_LANGUAGE') private readonly changeLanguage: ChangeLanguageUseCase,
        private readonly sessions: HttpSessions,
        private readonly limiter: LoginLimiter,
        @Inject('IDENTITY_SESSION_RENEWAL') private readonly renewal: SessionRenewal,
    ) {}

    @Get('auth/csrf')
    @Access('public')
    csrf(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
        response.setHeader('Cache-Control', 'no-store');

        return { token: this.sessions.csrf(request, response) };
    }

    @Post('auth/login')
    @HttpCode(200)
    @Access('public')
    async signIn(
        @Body({ schema: loginSchema }) input: z.infer<typeof loginSchema>,
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ) {
        this.limiter.check(request);
        const result = await this.login.execute(input.username, input.password);

        this.sessions.set(request, response, result.token);

        return this.dto(result.actor);
    }

    @Get('auth/me')
    @Access('credentials')
    me(@Req() request: AuthenticatedRequest) {
        return this.dto(request.actor);
    }

    @Post('auth/logout')
    @HttpCode(204)
    @Access('credentials')
    logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
        this.sessions.clear(request, response);
    }

    @Patch('account/username')
    @Access('credentials')
    async rename(
        @Body({ schema: usernameSchema }) input: z.infer<typeof usernameSchema>,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.dto(
            await this.changeUsername.execute(request.actor, input.username, input.currentPassword),
        );
    }

    @Patch('account/password')
    @Access('credentials')
    async replacePassword(
        @Body({ schema: passwordSchema }) input: z.infer<typeof passwordSchema>,
        @Req() request: AuthenticatedRequest,
        @Res({ passthrough: true }) response: Response,
    ) {
        const actor = await this.changePassword.execute(
            request.actor,
            input.currentPassword,
            input.password,
        );

        this.sessions.set(request, response, await this.renewal.renew(actor));

        return this.dto(actor);
    }

    @Patch('account/language')
    @Access('credentials')
    async chooseLanguage(
        @Body({ schema: languageSchema }) input: z.infer<typeof languageSchema>,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.dto(await this.changeLanguage.execute(request.actor, input.language));
    }

    private dto(actor: Actor): Account {
        const { id, username, role, mustChangePassword, language } = actor;

        return { id, username, role, mustChangePassword, language };
    }
}
