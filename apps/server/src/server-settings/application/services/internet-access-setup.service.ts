import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessFailureReason } from '../../domain/entities/internet-access.entity.js';
import { TlsSettings } from '../../domain/value-objects/tls-settings.value-object.js';
import type { CertificateAuthority } from '../ports/driven/certificate-authority.interface.js';
import type { DomainNameReader } from '../ports/driven/domain-name-reader.interface.js';
import type { HttpInternetAccessStore } from '../ports/driven/http-internet-access-store.interface.js';
import type { HttpsRuntime } from '../ports/driven/https-runtime.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { PublicAddressProbe } from '../ports/driven/public-address-probe.interface.js';
import type { RouterGateway } from '../ports/driven/router-gateway.interface.js';
import type { TlsStore } from '../ports/driven/tls-store.interface.js';
import type { DomainNameCheck } from './domain-name-check.service.js';
import type { HttpPortForwarding } from './http-port-forwarding.service.js';

// The steps of an internet access setup, run after the Admin's request has answered: find the
// router, open the port, get the certificate. Each step is saved so the page can follow it. Once
// HTTPS works, HTTP from the internet is closed.
export class InternetAccessSetup {
    private active = 0;

    constructor(
        private readonly store: InternetAccessStore,
        private readonly router: RouterGateway,
        private readonly probe: PublicAddressProbe,
        private readonly authority: CertificateAuthority,
        private readonly https: HttpsRuntime,
        private readonly tls: TlsStore,
        private readonly domains: DomainNameCheck,
        private readonly names: DomainNameReader,
        private readonly http: HttpInternetAccessStore,
        private readonly forwarding: HttpPortForwarding,
        private readonly clock: Clock,
    ) {}

    get running(): boolean {
        return this.active > 0;
    }

    async run(): Promise<void> {
        await this.guarded(async (access) => {
            if (await this.openPort(access)) {
                await this.obtain(access);
            }
        });
    }

    async check(): Promise<void> {
        await this.guarded((access) => this.obtain(access));
    }

    // After the Admin saved another domain name: while HTTPS is on, get a certificate for it at once.
    // A failure keeps the current certificate, like an upkeep failure.
    async followDomain(): Promise<void> {
        const access = await this.store.read();
        const saved = await this.names.read();

        if (access.phase !== 'active' || access.domain === saved) {
            return;
        }

        access.useDomain(saved);
        const reason = await this.renew(access).catch(() => 'setup-failed' as const);

        if (reason) {
            access.upkeepFailed(reason, this.clock.now());
        } else {
            access.upkeepSucceeded();
        }

        await this.store.save(access);
    }

    // Gets and installs a certificate for the domain name, or else the current public address. Used
    // by the setup and by the upkeep; answers the failure reason, or null once the certificate is in
    // use. A domain name must point to the public address first.
    async renew(access: InternetAccess): Promise<InternetAccessFailureReason | null> {
        const problem = await this.domains.problem(access);

        if (problem) {
            return problem;
        }

        const { port } = await this.tls.read();

        if (!(await this.https.ensureRunning(port))) {
            return 'https-unavailable';
        }

        const issue = await this.authority.issue({
            kind: access.domain ? 'domain' : 'address',
            name: access.certificateName!,
        });

        if (issue.outcome === 'refused') {
            return issue.reason;
        }

        const { chain, key, issuedAt, expiresAt } = issue.certificate;

        await this.tls.save(new TlsSettings({ enabled: true, port, hasCertificate: true }), {
            chain,
            key,
        });

        if (!(await this.https.install(port, { chain, key }))) {
            return 'https-unavailable';
        }

        access.activate({ address: access.certificateName!, issuedAt, expiresAt });

        return null;
    }

    private async guarded(steps: (access: InternetAccess) => Promise<void>): Promise<void> {
        this.active++;
        const access = await this.store.read();

        try {
            await steps(access);
        } catch {
            access.stop('setup-failed', this.clock.now());
        } finally {
            this.active--;
        }

        await this.store.save(access);
    }

    private async openPort(access: InternetAccess): Promise<boolean> {
        const now = this.clock.now();
        const router = await this.router.find();

        if (!router) {
            const address = await this.probe.current();

            if (address) {
                access.portNeeded(address, 'no-router', now);
            } else {
                access.stop('public-address-unknown', now);
            }

            return false;
        }

        if (!access.routerFound(router.mapping, router.externalAddress, now)) {
            return false;
        }

        await this.store.save(access);
        const { port } = await this.tls.read();
        const opened = await this.router.open({
            externalPort: InternetAccess.externalPort,
            internalPort: port,
        });

        if (!opened) {
            access.portNeeded(router.externalAddress, 'port-refused', now);

            return false;
        }

        access.portOpened();
        await this.store.save(access);

        return true;
    }

    private async obtain(access: InternetAccess): Promise<void> {
        const reason = await this.renew(access);
        const now = this.clock.now();

        if (reason === 'not-reachable') {
            access.certificateRefused(reason, now);
        } else if (reason) {
            access.stop(reason, now);
        } else {
            await this.closeHttp();
        }
    }

    // HTTPS works: plain HTTP no longer needs to be open. A failure to remove the router rule does
    // not undo the HTTPS setup.
    private async closeHttp(): Promise<void> {
        const http = await this.http.read();

        if (http.phase !== 'open') {
            return;
        }

        await this.forwarding.close(http, true).catch(() => http.close(true));
        await this.http.save(http);
    }
}
