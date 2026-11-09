import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessFailureReason } from '../../domain/entities/internet-access.entity.js';
import { ConnectionClass } from '../../domain/value-objects/connection-class.value-object.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { PublicAddressProbe } from '../ports/driven/public-address-probe.interface.js';
import type { RouterGateway } from '../ports/driven/router-gateway.interface.js';
import type { TlsSettingsReader } from '../ports/driven/tls-settings-reader.interface.js';
import type { MaintainInternetAccessUseCase } from '../ports/driving/maintain-internet-access-use-case.interface.js';
import type { DomainNameCheck } from '../services/domain-name-check.service.js';
import type { InternetAccessSetup } from '../services/internet-access-setup.service.js';

// The hourly upkeep: recreate the router rule, follow a changed public address, check that the
// domain name still points to it, and renew the certificate. A failure keeps the current
// certificate and waits longer before the next try.
export class MaintainInternetAccess implements MaintainInternetAccessUseCase {
    constructor(
        private readonly store: InternetAccessStore,
        private readonly router: RouterGateway,
        private readonly probe: PublicAddressProbe,
        private readonly tls: TlsSettingsReader,
        private readonly setup: InternetAccessSetup,
        private readonly domains: DomainNameCheck,
        private readonly clock: Clock,
    ) {}

    async execute(): Promise<void> {
        const access = await this.store.read();
        const now = this.clock.now();

        if (access.phase === 'setting-up' && !this.setup.running) {
            access.interrupted(now);
            await this.store.save(access);

            return;
        }

        if (!access.upkeepDue(now)) {
            return;
        }

        const reason = await this.upkeep(access).catch(() => 'setup-failed' as const);

        if (reason) {
            access.upkeepFailed(reason, now);
        } else {
            access.upkeepSucceeded();
        }

        await this.store.save(access);
    }

    private async upkeep(access: InternetAccess): Promise<InternetAccessFailureReason | null> {
        const manual = access.mapping === 'manual';
        const address = manual ? await this.probe.current() : await this.openRule();

        if (!address) {
            return manual ? 'public-address-unknown' : 'no-router';
        }

        if (address === 'refused') {
            return 'port-refused';
        }

        const connection = ConnectionClass.of(address);

        if (!connection.reachable) {
            return connection.kind === 'cgnat' ? 'cgnat' : 'double-nat';
        }

        if (connection.address !== access.publicAddress) {
            access.addressChanged(connection.address);
        }

        const problem = await this.domains.problem(access);

        if (problem) {
            return problem;
        }

        return access.renewalDue(this.clock.now()) ? this.setup.renew(access) : null;
    }

    // Recreating the rule follows a new local address and survives a router restart.
    private async openRule(): Promise<string | null> {
        const router = await this.router.find();

        if (!router) {
            return null;
        }

        const { port } = await this.tls.read();
        const opened = await this.router.open({
            externalPort: InternetAccess.externalPort,
            internalPort: port,
        });

        return opened ? router.externalAddress : 'refused';
    }
}
