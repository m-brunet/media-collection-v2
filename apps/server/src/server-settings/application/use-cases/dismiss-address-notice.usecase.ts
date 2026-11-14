import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { DismissAddressNoticeUseCase } from '../ports/driving/dismiss-address-notice-use-case.interface.js';

export class DismissAddressNotice implements DismissAddressNoticeUseCase {
    constructor(private readonly store: InternetAccessStore) {}

    async execute(actor: Actor): Promise<void> {
        ActorAuthorization.requireAdmin(actor);
        const access = await this.store.read();

        if (access.snapshot.addressMoved) {
            access.addressNoticeSeen();
            await this.store.save(access);
        }
    }
}
