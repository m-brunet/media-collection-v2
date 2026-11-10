import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessFailureReason } from '../../domain/entities/internet-access.entity.js';
import { TlsSettings } from '../../domain/value-objects/tls-settings.value-object.js';
import type { CertificateAuthority } from '../ports/driven/certificate-authority.interface.js';
import type { DomainNameReader } from '../ports/driven/domain-name-reader.interface.js';
import type { HttpsRuntime } from '../ports/driven/https-runtime.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { TlsCertificateReader } from '../ports/driven/tls-certificate-reader.interface.js';
import type { TlsStore } from '../ports/driven/tls-store.interface.js';
import type { DomainNameCheck } from './domain-name-check.service.js';
import type { HttpInternetAccessClosing } from './http-internet-access-closing.service.js';
import type { RouterRules } from './router-rules.service.js';

// Each step is saved so the page can follow it.
export class InternetAccessSetup {
    private active = 0;

    constructor(
        private readonly store: InternetAccessStore,
        private readonly rules: RouterRules,
        private readonly authority: CertificateAuthority,
        private readonly https: HttpsRuntime,
        private readonly tls: TlsStore & TlsCertificateReader,
        private readonly domains: DomainNameCheck,
        private readonly names: DomainNameReader,
        private readonly httpClosing: HttpInternetAccessClosing,
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

    // While active (after a failed check), a failure keeps the current certificate.
    async check(): Promise<void> {
        await this.guarded((access) =>
            access.phase === 'active' ? this.recheck(access) : this.obtain(access),
        );
    }

    // A failure keeps the current certificate, like an upkeep failure.
    async followDomain(): Promise<void> {
        const access = await this.store.read();
        const saved = await this.names.read();

        if (access.phase !== 'active' || access.domain === saved) {
            return;
        }

        access.useDomain(saved);
        await this.recheck(access);
        await this.store.save(access);
    }

    // The one way to Let's Encrypt: nothing is asked before its own date after a rate limit, and
    // each certificate and failed check is recorded for the estimate.
    async renew(access: InternetAccess): Promise<InternetAccessFailureReason | null> {
        if (!access.attemptAllowed(this.clock.now())) {
            return 'rate-limited';
        }

        const problem = await this.domains.problem(access);

        if (problem) {
            return problem;
        }

        const { port } = await this.tls.read();

        if (!(await this.https.ensureRunning(port))) {
            return 'https-unavailable';
        }

        const name = access.certificateName!;
        // Same name: an ARI renewal of the certificate in use, which Let's Encrypt does not count.
        const replacing =
            access.certificate?.address === name ? await this.tls.currentChain() : null;
        const issue = await this.authority.issue(
            { kind: access.domain ? 'domain' : 'address', name },
            replacing,
        );

        if (issue.outcome === 'refused') {
            access.authorityRefused(
                issue.reason,
                issue.reason === 'rate-limited' ? issue.retryAfter : null,
                this.clock.now(),
            );

            return issue.reason;
        }

        access.certificateIssued(issue.renewal, this.clock.now());
        const { chain, key, issuedAt, expiresAt } = issue.certificate;

        await this.tls.save(new TlsSettings({ enabled: true, port, hasCertificate: true }), {
            chain,
            key,
        });

        if (!(await this.https.install(port, { chain, key }))) {
            return 'https-unavailable';
        }

        access.activate({ address: name, issuedAt, expiresAt });

        return null;
    }

    private async recheck(access: InternetAccess): Promise<void> {
        const reason = await this.renew(access).catch(() => 'setup-failed' as const);

        if (reason) {
            access.upkeepFailed(reason, this.clock.now());
        } else {
            access.upkeepSucceeded();
        }
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
        const search = await this.rules.find();

        if (!search.router) {
            if (search.publicAddress) {
                access.portNeeded(search.publicAddress, 'no-router', now);
            } else {
                access.stop('public-address-unknown', now);
            }

            return false;
        }

        const router = search.router;

        if (!access.routerFound(router.mapping, router.externalAddress, now)) {
            return false;
        }

        await this.store.save(access);
        const { port } = await this.tls.read();
        const opened = await this.rules.open({
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
            await this.httpClosing.becauseHttpsWorks();
        }
    }
}
