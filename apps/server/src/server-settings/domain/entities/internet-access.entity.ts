import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { RenewalPolicy } from '../services/renewal-policy.service.js';
import { ConnectionClass } from '../value-objects/connection-class.value-object.js';
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
    | 'setup-failed';

export interface InternetAccessState {
    phase: InternetAccessPhase;
    step: SetupStep | null;
    mapping: PortMapping | null;
    publicAddress: string | null;
    certificate: IssuedCertificateState | null;
    failure: { reason: InternetAccessFailureReason; at: string } | null;
    failedAttempts: number;
    nextAttemptAt: string | null;
}

// Automatic internet access: the router rule, the public address and the certificate that lets
// phones reach the installation over HTTPS. A setup runs in steps; once active, the upkeep keeps
// the certificate valid for the current public address.
export class InternetAccess {
    // The router's port that phones reach; Let's Encrypt only checks an IP address on 443.
    static readonly externalPort = 443;
    private state: InternetAccessState;

    constructor(state: InternetAccessState) {
        if (state.certificate) {
            new IssuedCertificate(state.certificate);
        }

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

    get certificate(): IssuedCertificate | null {
        return this.state.certificate ? new IssuedCertificate(this.state.certificate) : null;
    }

    get snapshot(): InternetAccessState {
        return InternetAccess.copy(this.state);
    }

    start(): void {
        if (this.state.phase === 'setting-up') {
            throw new Failure(
                'conflict',
                'Internet access is already being set up.',
                'setup-in-progress',
            );
        }

        this.state = {
            ...InternetAccess.off().state,
            phase: 'setting-up',
            step: 'router',
            certificate: this.state.certificate,
        };
    }

    // Reruns the certificate step after the Admin created the router rule by hand.
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

    // Records the router's answer: a CGNAT or private external address ends the setup.
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

    // Without a router that accepts rules, the Admin creates the rule by hand.
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

    // The setup cannot go further (no public address, or the provider shares it).
    stop(reason: InternetAccessFailureReason, now: Date): void {
        this.state = {
            ...InternetAccess.off().state,
            failure: { reason, at: now.toISOString() },
        };
    }

    // An unreachable port during the setup sends the Admin to the manual rule screen.
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
            this.state.mapping !== null && issued.address === this.state.publicAddress,
            'The certificate must cover the public address.',
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

    addressChanged(publicAddress: string): void {
        this.requireActive();
        this.state = { ...this.state, publicAddress: ConnectionClass.of(publicAddress).address };
    }

    renewalDue(now: Date): boolean {
        return (
            this.state.phase === 'active' &&
            RenewalPolicy.renewalDue(this.certificate, this.state.publicAddress!, now)
        );
    }

    upkeepDue(now: Date): boolean {
        return (
            this.state.phase === 'active' &&
            (!this.state.nextAttemptAt || now.getTime() >= Date.parse(this.state.nextAttemptAt))
        );
    }

    // The current certificate stays in use while it is valid; the next attempt waits longer.
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

        this.state = InternetAccess.off().state;
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
