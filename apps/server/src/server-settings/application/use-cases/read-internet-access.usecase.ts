import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessReader } from '../ports/driven/internet-access-reader.interface.js';
import type { LocalAddressReader } from '../ports/driven/local-address-reader.interface.js';
import type { InternetAccessView } from '../ports/driving/internet-access-view.interface.js';
import type { ManualPortRule } from '../ports/driving/manual-port-rule.interface.js';
import type { ReadInternetAccessUseCase } from '../ports/driving/read-internet-access-use-case.interface.js';

export class ReadInternetAccess implements ReadInternetAccessUseCase {
    constructor(
        private readonly store: InternetAccessReader,
        private readonly local: LocalAddressReader,
        private readonly clock: Clock,
    ) {}

    async execute(actor: Actor): Promise<InternetAccessView> {
        ActorAuthorization.requireAdmin(actor);
        const access = await this.store.read();
        const now = this.clock.now();
        const { history: _history, ...state } = access.snapshot;
        const port = access.mapping === 'manual' ? access.routerPort : null;
        const localAddress = port === null ? null : await this.local.current();

        return {
            ...state,
            retryAfter: access.attemptAllowed(now) ? null : state.retryAfter,
            allowances: access.allowances(now),
            origin: access.origin,
            renewalAt: access.renewalAt?.toISOString() ?? null,
            manualRule: port === null ? null : ReadInternetAccess.rule(localAddress, port, port),
            checkRule:
                port === null
                    ? null
                    : ReadInternetAccess.rule(localAddress, InternetAccess.checkPort, port),
        };
    }

    private static rule(
        localAddress: string | null,
        externalPort: number,
        internalPort: number,
    ): ManualPortRule {
        return { localAddress, internalPort, externalPort, protocol: 'TCP' };
    }
}
