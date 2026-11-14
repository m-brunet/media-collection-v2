import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { InternetAccessState } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { RouterGateway } from '../ports/driven/router-gateway.interface.js';
import type { TurnOffInternetAccessUseCase } from '../ports/driving/turn-off-internet-access-use-case.interface.js';
import { SettingsAudit } from '../settings-audit.js';

export class TurnOffInternetAccess implements TurnOffInternetAccessUseCase {
    constructor(
        private readonly store: InternetAccessStore,
        private readonly router: RouterGateway,
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
                const port = access.automatic ? access.routerPort : null;

                access.turnOff();

                if (port !== null) {
                    await this.router.close({ externalPort: port, internalPort: port });
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
