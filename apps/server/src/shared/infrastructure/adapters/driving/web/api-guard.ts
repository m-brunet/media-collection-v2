import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Actor } from '../../../../domain/actor.helper.js';
import { ActorAuthorization } from '../../../../domain/actor.helper.js';
import type { Authentication } from '../../../../application/ports/driving/authentication.interface.js';
import type { SessionRenewal } from '../../../../application/ports/driving/session-renewal.interface.js';
import { HttpSessions } from './http-sessions.service.js';

export const Access = (access: 'public' | 'credentials' | 'admin') => SetMetadata('access', access);

export interface AuthenticatedRequest extends Request {
    actor: Actor;
}

export class ApiGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly authentication: Authentication,
        private readonly renewal: SessionRenewal,
        private readonly sessions: HttpSessions,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const access = this.reflector.getAllAndOverride<string>('access', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (access === 'public') {
            return true;
        }

        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const response = context.switchToHttp().getResponse<Response>();
        const token = this.sessions.token(request);

        if (!token) {
            throw new UnauthorizedException('Sign in to continue.');
        }

        request.actor = await this.authentication.authenticate(token);

        if (access !== 'credentials') {
            ActorAuthorization.requireReady(request.actor);
        }

        if (access === 'admin') {
            ActorAuthorization.requireAdmin(request.actor);
        }

        if (request.get('x-app-activity') !== 'passive') {
            this.sessions.set(request, response, await this.renewal.renew(request.actor));
        }

        return true;
    }
}
