import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { ConnectionClass } from '../value-objects/connection-class.value-object.js';
import type { InternetAccessFailureReason, PortMapping } from './internet-access.entity.js';

export type HttpInternetAccessPhase = 'off' | 'open';
export type HttpInternetAccessFailureReason = Extract<
    InternetAccessFailureReason,
    | 'no-router'
    | 'port-refused'
    | 'cgnat'
    | 'double-nat'
    | 'public-address-unknown'
    | 'setup-failed'
>;

export interface HttpInternetAccessState {
    phase: HttpInternetAccessPhase;
    mapping: PortMapping | null;
    publicAddress: string | null;
    // Why the rule is by hand, why opening stopped, or the last upkeep failure.
    failure: { reason: HttpInternetAccessFailureReason; at: string } | null;
    // Closed by a working HTTPS setup rather than by the Admin.
    closedByHttps: boolean;
}

// Plain HTTP opened to the internet at the Admin's request: a router rule from the HTTP port to
// the same port on this computer. Not encrypted; a working HTTPS setup closes it.
export class HttpInternetAccess {
    private state: HttpInternetAccessState;

    constructor(state: HttpInternetAccessState) {
        Failure.ensure(
            state.phase !== 'open' || (state.mapping !== null && state.publicAddress !== null),
            'Open HTTP internet access needs a router rule and a public address.',
        );
        this.state = HttpInternetAccess.copy(state);
    }

    static off(): HttpInternetAccess {
        return new HttpInternetAccess({
            phase: 'off',
            mapping: null,
            publicAddress: null,
            failure: null,
            closedByHttps: false,
        });
    }

    get phase(): HttpInternetAccessPhase {
        return this.state.phase;
    }

    get publicAddress(): string | null {
        return this.state.publicAddress;
    }

    // The application created the router rule, so it also removes it.
    get automatic(): boolean {
        return this.state.mapping === 'upnp' || this.state.mapping === 'nat-pmp';
    }

    get snapshot(): HttpInternetAccessState {
        return HttpInternetAccess.copy(this.state);
    }

    // Only a public address can receive connections from the internet.
    static usable(address: string): boolean {
        return ConnectionClass.of(address).reachable;
    }

    // The router accepted the rule.
    opened(mapping: Exclude<PortMapping, 'manual'>, externalAddress: string): void {
        this.state = {
            phase: 'open',
            mapping,
            publicAddress: this.reachable(externalAddress),
            failure: null,
            closedByHttps: false,
        };
    }

    // No router answered, or it refused the rule: the Admin adds it by hand.
    openedByHand(
        publicAddress: string,
        reason: Extract<HttpInternetAccessFailureReason, 'no-router' | 'port-refused'>,
        now: Date,
    ): void {
        this.state = {
            phase: 'open',
            mapping: 'manual',
            publicAddress: this.reachable(publicAddress),
            failure: { reason, at: now.toISOString() },
            closedByHttps: false,
        };
    }

    // Opening cannot work: the provider shares the address, a second router, no public address.
    refused(reason: HttpInternetAccessFailureReason, now: Date): void {
        this.state = {
            ...HttpInternetAccess.off().state,
            failure: { reason, at: now.toISOString() },
        };
    }

    // Refuses a CGNAT or private address with the reason the Admin needs.
    static blockedReason(address: string): 'cgnat' | 'double-nat' {
        return ConnectionClass.of(address).kind === 'cgnat' ? 'cgnat' : 'double-nat';
    }

    close(byHttps: boolean): void {
        this.state = { ...HttpInternetAccess.off().state, closedByHttps: byHttps };
    }

    addressChanged(publicAddress: string): void {
        this.requireOpen();
        this.state = { ...this.state, publicAddress: this.reachable(publicAddress) };
    }

    // The rule stays as it is; the panel shows what went wrong.
    upkeepFailed(reason: HttpInternetAccessFailureReason, now: Date): void {
        this.requireOpen();
        this.state = { ...this.state, failure: { reason, at: now.toISOString() } };
    }

    // A rule by hand keeps the reason it is by hand.
    upkeepSucceeded(): void {
        this.requireOpen();

        if (this.automatic) {
            this.state = { ...this.state, failure: null };
        }
    }

    private reachable(address: string): string {
        const connection = ConnectionClass.of(address);

        Failure.ensure(connection.reachable, 'HTTP internet access needs a public address.');

        return connection.address;
    }

    private requireOpen(): void {
        Failure.ensure(this.state.phase === 'open', 'HTTP internet access is not open.');
    }

    private static copy(state: HttpInternetAccessState): HttpInternetAccessState {
        return { ...state, failure: state.failure ? { ...state.failure } : null };
    }
}
