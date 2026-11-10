import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { HttpInternetAccessState } from '../../domain/entities/http-internet-access.entity.js';
import type { HttpInternetAccessStore } from '../ports/driven/http-internet-access-store.interface.js';
import type { InternetAccessReader } from '../ports/driven/internet-access-reader.interface.js';
import type { OpenHttpInternetAccessUseCase } from '../ports/driving/open-http-internet-access-use-case.interface.js';
import type { HttpPortForwarding } from '../services/http-port-forwarding.service.js';
import { SettingsAudit } from '../settings-audit.js';

// Never while HTTPS is on: phones then use the encrypted address.
export class OpenHttpInternetAccess implements OpenHttpInternetAccessUseCase {
    constructor(
        private readonly store: HttpInternetAccessStore,
        private readonly https: InternetAccessReader,
        private readonly forwarding: HttpPortForwarding,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor): Promise<HttpInternetAccessState> {
        return this.operations.run(
            {
                category: SettingsAudit.httpInternetAccessOpened,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'http-internet-access',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);

                if ((await this.https.read()).phase === 'active') {
                    throw new Failure(
                        'conflict',
                        'HTTPS works from the internet: HTTP stays closed.',
                        'https-active',
                    );
                }

                const access = await this.store.read();
                const before = access.snapshot;

                await this.forwarding.open(access);
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
