import type { SessionTokenVerifier } from '../ports/driven/session-token-verifier.interface.js';
import type { Authentication } from '../../../shared/application/ports/driving/authentication.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { AccountLoader } from '../services/account-loader.service.js';

export class AuthenticateSession implements Authentication {
    constructor(
        private readonly accounts: AccountLoader,
        private readonly tokens: SessionTokenVerifier,
    ) {}

    async authenticate(token: string): Promise<Actor> {
        const claims = await this.tokens.verify(token);

        if (!claims) {
            throw new Failure('unauthorized', 'Sign in again.');
        }

        const user = await this.accounts.load(claims.userId);

        if (user.snapshot.tokenVersion !== claims.version) {
            throw new Failure('unauthorized', 'Sign in again.');
        }

        return {
            ...user.actor,
            sessionVersion: claims.version,
            mustChangePassword: user.actor.mustChangePassword || claims.restricted,
        };
    }
}
