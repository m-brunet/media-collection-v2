import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { DomainName } from '../../domain/value-objects/domain-name.value-object.js';
import type { BackgroundTasks } from '../ports/driven/background-tasks.interface.js';
import type { DomainNameStore } from '../ports/driven/domain-name-store.interface.js';
import type { InternetAccessReader } from '../ports/driven/internet-access-reader.interface.js';
import type { SaveDomainNameUseCase } from '../ports/driving/save-domain-name-use-case.interface.js';
import type { DomainNameCheck } from '../services/domain-name-check.service.js';
import type { InternetAccessSetup } from '../services/internet-access-setup.service.js';
import type { PublicAddressLookup } from '../services/public-address-lookup.service.js';
import { SettingsAudit } from '../settings-audit.js';

// Saves the Admin's domain name once it points to this connection, so the internet addresses never
// switch to a name that does not work. HTTPS, when on, then gets a certificate for it. The name can
// only be removed while HTTPS is off.
export class SaveDomainName implements SaveDomainNameUseCase {
    constructor(
        private readonly store: DomainNameStore,
        private readonly https: InternetAccessReader,
        private readonly lookup: PublicAddressLookup,
        private readonly check: DomainNameCheck,
        private readonly setup: InternetAccessSetup,
        private readonly background: BackgroundTasks,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, input: { domain: string | null }): Promise<string | null> {
        const saved = await this.operations.run(
            {
                category: SettingsAudit.domainName,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'domain-name',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const name = DomainName.optional(input.domain);
                const before = await this.store.read();

                if (name) {
                    await this.requirePointsHere(name.value);
                } else if (before !== null && (await this.https.read()).phase !== 'off') {
                    throw new Failure(
                        'conflict',
                        'Turn off HTTPS from the internet before removing the domain name.',
                        'domain-name-in-use',
                    );
                }

                await this.store.save(name);
                const after = name ? name.value : null;

                return { result: after, before: { domain: before }, after: { domain: after } };
            },
        );

        this.background.run(() => this.setup.followDomain());

        return saved;
    }

    private async requirePointsHere(name: string): Promise<void> {
        const address = await this.lookup.current();

        if (!address) {
            throw new Failure(
                'invalid_input',
                'The public address of this connection could not be found to check the domain name.',
                'public-address-unknown',
            );
        }

        const problem = await this.check.problemFor(name, address);

        if (problem) {
            throw new Failure(
                'invalid_input',
                problem === 'domain-unresolved'
                    ? 'The domain name does not point to any address.'
                    : 'The domain name does not point to this connection.',
                problem,
                { publicAddress: address },
            );
        }
    }
}
