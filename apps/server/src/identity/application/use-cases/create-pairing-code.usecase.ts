import type { CreatePairingCodeUseCase } from '../ports/driving/create-pairing-code-use-case.interface.js';
import type { PairingAddresses } from '../ports/driven/pairing-addresses.interface.js';
import type { PairingCodeWriter } from '../ports/driven/pairing-code-writer.interface.js';
import type { PairingSecrets } from '../ports/driven/pairing-secrets.interface.js';
import type { AccountLoader } from '../services/account-loader.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { PairingCode } from '../../domain/entities/pairing-code.entity.js';
import { AccountAudit } from '../account-audit.js';

export class CreatePairingCode implements CreatePairingCodeUseCase {
    constructor(
        private readonly accounts: AccountLoader,
        private readonly addresses: PairingAddresses,
        private readonly secrets: PairingSecrets,
        private readonly codes: PairingCodeWriter,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, address: string): Promise<{ link: string; expiresAt: string }> {
        return this.operations.run(
            {
                category: AccountAudit.pairingCodeCreated,
                actorId: actor.id,
                subjectType: AccountAudit.subject,
                subjectId: actor.id,
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const account = await this.accounts.load(actor.id);

                if (!(await this.addresses.accepts(address))) {
                    throw new Failure(
                        'invalid_input',
                        'This address cannot sign a phone in. Use its QR code to open Leaf only.',
                        'pairing-address-ineligible',
                    );
                }

                const secret = this.secrets.generate();
                const code = PairingCode.issue({
                    id: this.ids.next(),
                    account,
                    codeHash: this.secrets.hash(secret),
                    now: this.clock.now(),
                });

                await this.codes.replace(code);
                const { expiresAt } = code.snapshot;

                return {
                    result: { link: address + '/leaf/#pair=' + secret, expiresAt },
                    before: null,
                    after: { address, expiresAt },
                };
            },
        );
    }
}
