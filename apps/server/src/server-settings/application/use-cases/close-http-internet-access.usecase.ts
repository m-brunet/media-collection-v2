import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { HttpInternetAccessState } from '../../domain/entities/http-internet-access.entity.js';
import type { HttpInternetAccessStore } from '../ports/driven/http-internet-access-store.interface.js';
import type { CloseHttpInternetAccessUseCase } from '../ports/driving/close-http-internet-access-use-case.interface.js';
import type { HttpPortForwarding } from '../services/http-port-forwarding.service.js';
import { SettingsAudit } from '../settings-audit.js';

export class CloseHttpInternetAccess implements CloseHttpInternetAccessUseCase {
    constructor(
        private readonly store: HttpInternetAccessStore,
        private readonly forwarding: HttpPortForwarding,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor): Promise<HttpInternetAccessState> {
        return this.operations.run(
            {
                category: SettingsAudit.httpInternetAccessClosed,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'http-internet-access',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const access = await this.store.read();
                const before = access.snapshot;

                await this.forwarding.close(access, false);
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
