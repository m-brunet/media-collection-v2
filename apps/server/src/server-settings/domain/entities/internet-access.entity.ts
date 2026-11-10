import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { RenewalPolicy } from '../services/renewal-policy.service.js';
import { ConnectionClass } from '../value-objects/connection-class.value-object.js';
import { DomainName } from '../value-objects/domain-name.value-object.js';
import type { IssuedCertificateState } from '../value-objects/issued-certificate.value-object.js';
import { IssuedCertificate } from '../value-objects/issued-certificate.value-object.js';

export type InternetAccessPhase = 'off' | 'setting-up' | 'waiting-for-port' | 'active';
export type SetupStep = 'router' | 'port' | 'certificate';
export type PortMapping = 'upnp' | 'nat-pmp' | 'manual';
export type InternetAccessFailureReason =
    | 'no-router'
    | 'cgnat'
    | 'double-nat'
    | 'port-refused'
    | 'not-reachable'
    | 'public-address-unknown'
    | 'rate-limited'
    | 'authority-unavailable'
    | 'https-unavailable'
    | 'domain-unresolved'
    | 'domain-mismatch'
    | 'setup-failed';
export type RouterRuleFailureReason = Extract<
    InternetAccessFailureReason,
    'no-router' | 'public-address-unknown' | 'port-refused' | 'cgnat' | 'double-nat'
>;

export interface InternetAccessState {
    phase: InternetAccessPhase;
    step: SetupStep | null;
    mapping: PortMapping | null;
    publicAddress: string | null;
    // The Admin's own domain name, kept on the public address by dynamic DNS; null to use the address.
    domain: string | null;
    certificate: IssuedCertificateState | null;
    failure: { reason: InternetAccessFailureReason; at: string } | null;
    failedAttempts: number;
    nextAttemptAt: string | null;
}

export class InternetAccess {
    // Let's Encrypt's TLS-ALPN-01 check only uses 443.
    static readonly externalPort = 443;
    private static readonly ruleFailures: ReadonlySet<InternetAccessFailureReason> =
        new Set<RouterRuleFailureReason>([
            'no-router',
            'public-address-unknown',
            'port-refused',
            'cgnat',
            'double-nat',
        ]);
    private state: InternetAccessState;

    constructor(state: InternetAccessState) {
        if (state.certificate) {
            new IssuedCertificate(state.certificate);
        }

        Failure.ensure(
            state.domain === null || DomainName.optional(state.domain)?.value === state.domain,
            'A saved domain name must be valid.',
        );
        Failure.ensure(
            state.phase !== 'active' || (state.certificate !== null && state.mapping !== null),
            'Active internet access needs a certificate and a port rule.',
        );
        this.state = InternetAccess.copy(state);
    }

    static off(): InternetAccess {
        return new InternetAccess({
            phase: 'off',
            step: null,
            mapping: null,
            publicAddress: null,
            domain: null,
            certificate: null,
            failure: null,
            failedAttempts: 0,
            nextAttemptAt: null,
        });
    }

    get phase(): InternetAccessPhase {
        return this.state.phase;
    }

    get mapping(): PortMapping | null {
        return this.state.mapping;
    }

    get publicAddress(): string | null {
        return this.state.publicAddress;
    }

    get domain(): string | null {
        return this.state.domain;
    }

    get certificateName(): string | null {
        return this.state.domain ?? this.state.publicAddress;
    }

    get certificate(): IssuedCertificate | null {
        return this.state.certificate ? new IssuedCertificate(this.state.certificate) : null;
    }

    get snapshot(): InternetAccessState {
        return InternetAccess.copy(this.state);
    }

    start(domain: string | null): void {
        if (this.state.phase === 'setting-up') {
            throw new Failure(
                'conflict',
                'Internet access is already being set up.',
                'setup-in-progress',
            );
        }

        const name = DomainName.optional(domain);

        this.state = {
            ...InternetAccess.off().state,
            phase: 'setting-up',
            step: 'router',
            domain: name ? name.value : null,
            certificate: this.state.certificate,
        };
    }

    check(): void {
        if (this.state.phase !== 'waiting-for-port' || !this.state.publicAddress) {
            throw new Failure('conflict', 'There is no router rule to check.', 'nothing-to-check');
        }

        this.state = {
            ...this.state,
            phase: 'setting-up',
            step: 'certificate',
            failure: null,
        };
    }

    routerFound(
        mapping: Exclude<PortMapping, 'manual'>,
        externalAddress: string,
        now: Date,
    ): boolean {
        this.requireSettingUp();
        const connection = ConnectionClass.of(externalAddress);

        if (!connection.reachable) {
            this.stop(connection.kind === 'cgnat' ? 'cgnat' : 'double-nat', now);

            return false;
        }

        this.state = { ...this.state, mapping, publicAddress: connection.address, step: 'port' };

        return true;
    }

    portNeeded(publicAddress: string, reason: InternetAccessFailureReason, now: Date): void {
        this.requireSettingUp();
        const connection = ConnectionClass.of(publicAddress);

        if (!connection.reachable) {
            this.stop(connection.kind === 'cgnat' ? 'cgnat' : 'double-nat', now);

            return;
        }

        this.state = {
            ...this.state,
            phase: 'waiting-for-port',
            step: null,
            mapping: 'manual',
            publicAddress: connection.address,
            failure: { reason, at: now.toISOString() },
        };
    }

    portOpened(): void {
        this.requireSettingUp();
        this.state = { ...this.state, step: 'certificate' };
    }

    stop(reason: InternetAccessFailureReason, now: Date): void {
        this.state = {
            ...InternetAccess.off().state,
            domain: this.state.domain,
            failure: { reason, at: now.toISOString() },
        };
    }

    certificateRefused(reason: InternetAccessFailureReason, now: Date): void {
        this.requireSettingUp();
        this.state = {
            ...this.state,
            phase: 'waiting-for-port',
            step: null,
            failure: { reason, at: now.toISOString() },
        };
    }

    activate(certificate: IssuedCertificateState): void {
        const issued = new IssuedCertificate(certificate);

        Failure.ensure(
            this.state.mapping !== null && issued.address === this.certificateName,
            'The certificate must cover the domain name or the public address.',
        );
        this.state = {
            ...this.state,
            phase: 'active',
            step: null,
            certificate: issued.snapshot(),
            failure: null,
            failedAttempts: 0,
            nextAttemptAt: null,
        };
    }

    useDomain(domain: string | null): void {
        this.requireActive();
        const name = DomainName.optional(domain);

        this.state = { ...this.state, domain: name ? name.value : null };
    }

    addressChanged(publicAddress: string): void {
        this.requireActive();
        this.state = { ...this.state, publicAddress: ConnectionClass.of(publicAddress).address };
    }

    renewalDue(now: Date): boolean {
        return (
            this.state.phase === 'active' &&
            RenewalPolicy.renewalDue(
                this.certificate,
                this.certificateName!,
                this.state.domain ? RenewalPolicy.domainShare : RenewalPolicy.addressShare,
                now,
            )
        );
    }

    upkeepDue(now: Date): boolean {
        return (
            this.state.phase === 'active' &&
            (!this.state.nextAttemptAt || now.getTime() >= Date.parse(this.state.nextAttemptAt))
        );
    }

    upkeepFailed(reason: InternetAccessFailureReason, now: Date): void {
        this.requireActive();
        const failedAttempts = this.state.failedAttempts + 1;

        this.state = {
            ...this.state,
            failure: { reason, at: now.toISOString() },
            failedAttempts,
            nextAttemptAt: RenewalPolicy.retryAt(failedAttempts, now).toISOString(),
        };
    }

    // Shown at once, without waiting longer: the rule lapses within its lease, so the next upkeep
    // run tries it again.
    ruleFailed(reason: RouterRuleFailureReason, now: Date): void {
        this.requireActive();
        this.state = { ...this.state, failure: { reason, at: now.toISOString() } };
    }

    ruleKept(): void {
        this.requireActive();

        if (this.state.failure && InternetAccess.ruleFailures.has(this.state.failure.reason)) {
            this.state = { ...this.state, failure: null };
        }
    }

    upkeepSucceeded(): void {
        this.requireActive();
        this.state = { ...this.state, failure: null, failedAttempts: 0, nextAttemptAt: null };
    }

    turnOff(): void {
        if (this.state.phase === 'setting-up') {
            throw new Failure(
                'conflict',
                'Wait for the internet access setup to finish.',
                'setup-in-progress',
            );
        }

        this.state = { ...InternetAccess.off().state, domain: this.state.domain };
    }

    // A setup cut short by a restart cannot resume.
    interrupted(now: Date): void {
        if (this.state.phase === 'setting-up') {
            this.stop('setup-failed', now);
        }
    }

    private requireSettingUp(): void {
        Failure.ensure(this.state.phase === 'setting-up', 'Internet access is not being set up.');
    }

    private requireActive(): void {
        Failure.ensure(this.state.phase === 'active', 'Internet access is not active.');
    }

    private static copy(state: InternetAccessState): InternetAccessState {
        return {
            ...state,
            certificate: state.certificate ? { ...state.certificate } : null,
            failure: state.failure ? { ...state.failure } : null,
        };
    }
}
