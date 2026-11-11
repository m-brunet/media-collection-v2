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
    failure: { reason: HttpInternetAccessFailureReason; at: string } | null;
    closedByHttps: boolean;
}

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

    get automatic(): boolean {
        return this.state.mapping === 'upnp' || this.state.mapping === 'nat-pmp';
    }

    get snapshot(): HttpInternetAccessState {
        return HttpInternetAccess.copy(this.state);
    }

    static usable(address: string): boolean {
        return ConnectionClass.of(address).reachable;
    }

    opened(mapping: Exclude<PortMapping, 'manual'>, externalAddress: string): void {
        this.state = {
            phase: 'open',
            mapping,
            publicAddress: this.reachable(externalAddress),
            failure: null,
            closedByHttps: false,
        };
    }

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

    refused(reason: HttpInternetAccessFailureReason, now: Date): void {
        this.state = {
            ...HttpInternetAccess.off().state,
            failure: { reason, at: now.toISOString() },
        };
    }

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

    upkeepFailed(reason: HttpInternetAccessFailureReason, now: Date): void {
        this.requireOpen();
        this.state = { ...this.state, failure: { reason, at: now.toISOString() } };
    }

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
