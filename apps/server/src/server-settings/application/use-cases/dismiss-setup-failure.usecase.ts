import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { DismissSetupFailureUseCase } from '../ports/driving/dismiss-setup-failure-use-case.interface.js';

export class DismissSetupFailure implements DismissSetupFailureUseCase {
    constructor(private readonly store: InternetAccessStore) {}

    async execute(actor: Actor): Promise<void> {
        ActorAuthorization.requireAdmin(actor);
        const access = await this.store.read();

        if (access.setupFailureSeen()) {
            await this.store.save(access);
        }
    }
}
