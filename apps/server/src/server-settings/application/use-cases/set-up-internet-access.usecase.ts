import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { InternetAccessState } from '../../domain/entities/internet-access.entity.js';
import type { BackgroundTasks } from '../ports/driven/background-tasks.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { TlsSettingsReader } from '../ports/driven/tls-settings-reader.interface.js';
import type { SetUpInternetAccessUseCase } from '../ports/driving/set-up-internet-access-use-case.interface.js';
import type { InternetAccessSetup } from '../services/internet-access-setup.service.js';
import { SettingsAudit } from '../settings-audit.js';

export class SetUpInternetAccess implements SetUpInternetAccessUseCase {
    constructor(
        private readonly store: InternetAccessStore,
        private readonly tls: TlsSettingsReader,
        private readonly setup: InternetAccessSetup,
        private readonly background: BackgroundTasks,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(
        actor: Actor,
        input: { replaceCertificate: boolean },
    ): Promise<InternetAccessState> {
        const state = await this.operations.run(
            {
                category: SettingsAudit.internetAccessSetUp,
                actorId: actor.id,
                subjectType: SettingsAudit.subject,
                subjectId: 'internet-access',
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const access = await this.store.read();
                const before = access.snapshot;
                const tls = await this.tls.read();

                if (tls.hasCertificate && !access.certificate && !input.replaceCertificate) {
                    throw new Failure(
                        'conflict',
                        'An HTTPS certificate is already saved. Confirm to replace it.',
                        'certificate-replacement-unconfirmed',
                    );
                }

                access.start();
                await this.store.save(access);

                return {
                    result: access.snapshot,
                    before: { ...before },
                    after: { ...access.snapshot },
                };
            },
        );

        this.background.run(() => this.setup.run());

        return state;
    }
}
