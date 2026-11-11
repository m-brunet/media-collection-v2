import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessReader } from '../ports/driven/internet-access-reader.interface.js';
import type { LocalAddressReader } from '../ports/driven/local-address-reader.interface.js';
import type { TlsSettingsReader } from '../ports/driven/tls-settings-reader.interface.js';
import type { InternetAccessView } from '../ports/driving/internet-access-view.interface.js';
import type { ReadInternetAccessUseCase } from '../ports/driving/read-internet-access-use-case.interface.js';

export class ReadInternetAccess implements ReadInternetAccessUseCase {
    constructor(
        private readonly store: InternetAccessReader,
        private readonly tls: TlsSettingsReader,
        private readonly local: LocalAddressReader,
        private readonly clock: Clock,
    ) {}

    async execute(actor: Actor): Promise<InternetAccessView> {
        ActorAuthorization.requireAdmin(actor);
        const access = await this.store.read();
        const now = this.clock.now();
        const { history: _history, ...state } = access.snapshot;

        return {
            ...state,
            retryAfter: access.attemptAllowed(now) ? null : state.retryAfter,
            allowances: access.allowances(now),
            origin: access.phase === 'active' ? 'https://' + access.certificateName : null,
            manualRule:
                access.phase === 'waiting-for-port'
                    ? {
                          localAddress: await this.local.current(),
                          internalPort: (await this.tls.read()).port,
                          externalPort: InternetAccess.externalPort,
                          protocol: 'TCP',
                      }
                    : null,
        };
    }
}
