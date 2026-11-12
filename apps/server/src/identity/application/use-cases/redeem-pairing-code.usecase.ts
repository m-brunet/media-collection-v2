import type { RedeemPairingCodeUseCase } from '../ports/driving/redeem-pairing-code-use-case.interface.js';
import type { RedeemablePairingCodes } from '../ports/driven/redeemable-pairing-codes.interface.js';
import type { PairingSecrets } from '../ports/driven/pairing-secrets.interface.js';
import type { SessionTokenIssuer } from '../ports/driven/session-token-issuer.interface.js';
import type { UserReader } from '../ports/driven/user-reader.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { PairingCode } from '../../domain/entities/pairing-code.entity.js';
import { AccountAudit } from '../account-audit.js';

export class RedeemPairingCode implements RedeemPairingCodeUseCase {
    constructor(
        private readonly codes: RedeemablePairingCodes,
        private readonly secrets: PairingSecrets,
        private readonly users: UserReader,
        private readonly tokens: SessionTokenIssuer,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(secret: string): Promise<{ actor: Actor; token: string }> {
        return this.operations.run(
            {
                category: AccountAudit.signedInWithPairingCode,
                actorId: null,
                subjectType: AccountAudit.subject,
                subjectId: null,
            },
            async (context) => {
                const code = await this.codes.findByHash(this.secrets.hash(secret));
                const account = code ? await this.users.findById(code.accountId) : null;

                if (!code || !account) {
                    throw this.expired();
                }

                context.actorId = account.actor.id;
                context.subjectId = account.actor.id;
                code.redeem(account, this.clock.now());

                if (!(await this.codes.consume(code))) {
                    throw this.expired();
                }

                return {
                    result: {
                        actor: account.actor,
                        token: await this.tokens.issue({
                            userId: account.actor.id,
                            version: account.snapshot.tokenVersion,
                            restricted: false,
                        }),
                    },
                    before: null,
                    after: null,
                };
            },
        );
    }

    private expired(): Failure {
        return new Failure('unauthorized', PairingCode.expiredMessage, 'pairing-code-expired');
    }
}
