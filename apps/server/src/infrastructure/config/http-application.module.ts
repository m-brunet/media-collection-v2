import type { INestApplication } from '@nestjs/common';
import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Authentication } from '../../shared/application/ports/driving/authentication.interface.js';
import type { SessionRenewal } from '../../shared/application/ports/driving/session-renewal.interface.js';
import { ApiGuard } from '../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { HttpSessions } from '../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { FailureFilter } from '../../shared/infrastructure/adapters/driving/web/failure-filter.js';

@Module({})
export class HttpApplicationModule {
    static configure(
        application: INestApplication,
        authentication: Authentication,
        renewal: SessionRenewal,
        sessions: HttpSessions,
    ): void {
        application.useGlobalPipes(new StandardSchemaValidationPipe());
        application.useGlobalFilters(new FailureFilter());
        application.useGlobalGuards(
            new ApiGuard(new Reflector(), authentication, renewal, sessions),
        );
    }
}
