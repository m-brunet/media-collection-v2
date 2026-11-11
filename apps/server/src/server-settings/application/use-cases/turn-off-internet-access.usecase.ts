import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { InternetAccessState } from '../../domain/entities/internet-access.entity.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { RouterGateway } from '../ports/driven/router-gateway.interface.js';
import type { TlsSettingsReader } from '../ports/driven/tls-settings-reader.interface.js';
import type { TurnOffInternetAccessUseCase } from '../ports/driving/turn-off-internet-access-use-case.interface.js';
import { SettingsAudit } from '../settings-audit.js';

export class TurnOffInternetAccess implements TurnOffInternetAccessUseCase {
    constructor(
        private readonly store: InternetAccessStore,
        private readonly router: RouterGateway,
        private readonly tls: TlsSettingsReader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor): Promise<InternetAccessState> {
        return this.operations.run(
            {
                category: SettingsAudit.internetAccessTurnedOff,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'internet-access',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const access = await this.store.read();
                const before = access.snapshot;
                const automatic = access.mapping === 'upnp' || access.mapping === 'nat-pmp';

                access.turnOff();

                if (automatic) {
                    const { port } = await this.tls.read();

                    await this.router.close({
                        externalPort: InternetAccess.externalPort,
                        internalPort: port,
                    });
                }

                await this.store.save(access);

                return {
                    result: access.snapshot,
                    before: { ...before },
                    after: { ...access.snapshot },
                };
            },
        );
    }
}
