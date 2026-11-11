import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { Allowance, CertificateAttempt } from '../services/attempt-allowance.service.js';
import { AttemptAllowance } from '../services/attempt-allowance.service.js';
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
    domain: string | null;
    certificate: IssuedCertificateState | null;
    failure: { reason: InternetAccessFailureReason; at: string } | null;
    failedAttempts: number;
    nextAttemptAt: string | null;
    retryAfter: string | null;
    history: CertificateAttempt[];
    lastAttemptName: string | null;
    awaitingCheck: boolean;
}

export interface AttemptAllowances {
    certificates: Allowance;
    checks: Allowance;
}

export class InternetAccess {
    // Let's Encrypt's TLS-ALPN-01 check only uses 443.
    static readonly externalPort = 443;
    private static readonly defaultRetryAfterMs = 6 * 60 * 60 * 1000;
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
            retryAfter: null,
            history: [],
            lastAttemptName: null,
            awaitingCheck: false,
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

    get attemptName(): string | null {
        return this.certificateName ?? this.state.lastAttemptName;
    }

    attemptAllowed(now: Date): boolean {
        return !this.state.retryAfter || now.getTime() >= Date.parse(this.state.retryAfter);
    }

    ensureAttemptAllowed(now: Date): void {
        if (!this.attemptAllowed(now)) {
            throw new Failure(
                'conflict',
                'Let’s Encrypt accepts a new attempt after ' + this.state.retryAfter + '.',
                'rate-limited',
            );
        }
    }

    allowances(now: Date): AttemptAllowances | null {
        const name = this.attemptName;

        if (!name || (!this.state.failure && !this.state.retryAfter)) {
            return null;
        }

        return {
            certificates: AttemptAllowance.certificatesLeft(this.state.history, name, now),
            checks: AttemptAllowance.checksLeft(this.state.history, name, now),
        };
    }

    certificateIssued(renewal: boolean, now: Date): void {
        if (!renewal) {
            this.attempted('certificate', now);
        }

        this.state = { ...this.state, retryAfter: null };
    }

    // A failed check counts toward Let's Encrypt's hourly limit; a rate limit holds every attempt
    // until Let's Encrypt's date.
    authorityRefused(
        reason: InternetAccessFailureReason,
        retryAfter: string | null,
        now: Date,
    ): void {
        this.state = { ...this.state, lastAttemptName: this.certificateName };

        if (reason === 'not-reachable') {
            this.attempted('failed-check', now);
        } else if (reason === 'rate-limited') {
            const date = retryAfter ? Date.parse(retryAfter) : Number.NaN;

            this.state = {
                ...this.state,
                retryAfter: new Date(
                    Number.isFinite(date)
                        ? date
                        : now.getTime() + InternetAccess.defaultRetryAfterMs,
                ).toISOString(),
            };
        }
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
            ...this.kept(),
            phase: 'setting-up',
            step: 'router',
            domain: name ? name.value : null,
            certificate: this.state.certificate,
        };
    }

    check(): void {
        if (this.state.phase === 'active' && this.state.awaitingCheck && this.state.step === null) {
            this.state = { ...this.state, step: 'certificate' };

            return;
        }

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

    get checking(): boolean {
        return this.state.phase === 'active' && this.state.step !== null;
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
            ...this.kept(),
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
            awaitingCheck: false,
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
            this.state.step === null &&
            !this.state.awaitingCheck &&
            this.attemptAllowed(now) &&
            (!this.state.nextAttemptAt || now.getTime() >= Date.parse(this.state.nextAttemptAt))
        );
    }

    upkeepFailed(reason: InternetAccessFailureReason, now: Date): void {
        this.requireActive();
        const failedAttempts = this.state.failedAttempts + 1;
        const retryAt = RenewalPolicy.retryAt(failedAttempts, now);
        const nextAttemptAt =
            reason === 'rate-limited' && this.state.retryAfter
                ? new Date(Math.max(retryAt.getTime(), Date.parse(this.state.retryAfter)))
                : retryAt;

        this.state = {
            ...this.state,
            step: null,
            failure: { reason, at: now.toISOString() },
            failedAttempts,
            nextAttemptAt: nextAttemptAt.toISOString(),
            awaitingCheck: reason === 'not-reachable',
        };
    }

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
        this.state = {
            ...this.state,
            step: null,
            failure: null,
            failedAttempts: 0,
            nextAttemptAt: null,
            awaitingCheck: false,
        };
    }

    turnOff(): void {
        if (this.state.phase === 'setting-up') {
            throw new Failure(
                'conflict',
                'Wait for the internet access setup to finish.',
                'setup-in-progress',
            );
        }

        this.state = { ...this.kept(), domain: this.state.domain };
    }

    interrupted(now: Date): void {
        if (this.state.phase === 'setting-up') {
            this.stop('setup-failed', now);
        } else if (this.checking) {
            this.state = { ...this.state, step: null };
        }
    }

    private attempted(kind: CertificateAttempt['kind'], now: Date): void {
        const name = this.certificateName;

        if (!name) {
            return;
        }

        this.state = {
            ...this.state,
            lastAttemptName: name,
            history: [
                ...AttemptAllowance.recent(this.state.history, now),
                { name, at: now.toISOString(), kind },
            ],
        };
    }

    private kept(): InternetAccessState {
        return {
            ...InternetAccess.off().state,
            retryAfter: this.state.retryAfter,
            history: this.state.history,
            lastAttemptName: this.state.lastAttemptName,
        };
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
            history: state.history.map((attempt) => ({ ...attempt })),
        };
    }
}
