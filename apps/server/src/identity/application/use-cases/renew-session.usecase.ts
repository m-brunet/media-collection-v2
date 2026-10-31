import type { SessionTokenIssuer } from '../ports/driven/session-token-issuer.interface.js';
import type { SessionRenewal } from '../../../shared/application/ports/driving/session-renewal.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { AccountLoader } from '../services/account-loader.service.js';

export class RenewSession implements SessionRenewal {
    constructor(
        private readonly accounts: AccountLoader,
        private readonly tokens: SessionTokenIssuer,
    ) {}

    async renew(actor: Actor): Promise<string> {
        const user = await this.accounts.load(actor.id);

        if (
            actor.sessionVersion !== undefined &&
            user.snapshot.tokenVersion !== actor.sessionVersion
        ) {
            throw new Failure('unauthorized', 'Sign in again.');
        }

        return this.tokens.issue({
            userId: actor.id,
            version: user.snapshot.tokenVersion,
            restricted: actor.mustChangePassword,
        });
    }
}
