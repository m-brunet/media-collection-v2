import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessState } from '../../domain/entities/internet-access.entity.js';
import type {
    TlsSettings,
    TlsSettingsState,
} from '../../domain/value-objects/tls-settings.value-object.js';
import type { BackgroundTasks } from '../ports/driven/background-tasks.interface.js';
import type {
    CertificateAuthority,
    CertificateIssue,
} from '../ports/driven/certificate-authority.interface.js';
import type { HttpsRuntime } from '../ports/driven/https-runtime.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { KeepAwakeRuntime } from '../ports/driven/keep-awake-runtime.interface.js';
import type { KeepAwakeStore } from '../ports/driven/keep-awake-store.interface.js';
import type { LocalAddressReader } from '../ports/driven/local-address-reader.interface.js';
import type { PublicAddressProbe } from '../ports/driven/public-address-probe.interface.js';
import type { PortRule } from '../ports/driven/port-rule.interface.js';
import type { RouterConnection } from '../ports/driven/router-connection.interface.js';
import type { RouterGateway } from '../ports/driven/router-gateway.interface.js';
import type { TlsStore } from '../ports/driven/tls-store.interface.js';
import { InternetAccessSetup } from '../services/internet-access-setup.service.js';

export const publicAddress = '82.66.118.204';

export class MemoryInternetAccessStore implements InternetAccessStore {
    readonly phases: string[] = [];

    constructor(private state: InternetAccessState = InternetAccess.off().snapshot) {}

    async read(): Promise<InternetAccess> {
        return new InternetAccess(this.state);
    }

    async save(access: InternetAccess): Promise<void> {
        this.state = access.snapshot;
        this.phases.push(this.state.phase + (this.state.step ? ':' + this.state.step : ''));
    }

    get current(): InternetAccessState {
        return structuredClone(this.state);
    }
}

export class FakeRouter implements RouterGateway {
    readonly opened: PortRule[] = [];
    readonly closed: PortRule[] = [];

    constructor(
        public connection: RouterConnection | null = {
            mapping: 'upnp',
            externalAddress: publicAddress,
        },
        public accepts = true,
    ) {}

    async find(): Promise<RouterConnection | null> {
        return this.connection ? { ...this.connection } : null;
    }

    async open(rule: PortRule): Promise<boolean> {
        if (this.accepts) {
            this.opened.push(rule);
        }

        return this.accepts;
    }

    async close(rule: PortRule): Promise<void> {
        this.closed.push(rule);
    }
}

export class FakeProbe implements PublicAddressProbe {
    constructor(public address: string | null = publicAddress) {}

    async current(): Promise<string | null> {
        return this.address;
    }
}

export class FakeAuthority implements CertificateAuthority {
    readonly requested: string[] = [];
    refusal: Extract<CertificateIssue, { outcome: 'refused' }>['reason'] | null = null;
    failure: Error | null = null;

    constructor(private readonly clock: Clock) {}

    async issue(address: string): Promise<CertificateIssue> {
        this.requested.push(address);

        if (this.failure) {
            throw this.failure;
        }

        if (this.refusal) {
            return { outcome: 'refused', reason: this.refusal };
        }

        const issued = this.clock.now();

        return {
            outcome: 'issued',
            certificate: {
                chain: 'chain for ' + address,
                key: 'key for ' + address,
                issuedAt: issued.toISOString(),
                expiresAt: new Date(issued.getTime() + 160 * 3_600_000).toISOString(),
            },
        };
    }
}

export class FakeHttpsRuntime implements HttpsRuntime {
    readonly started: number[] = [];
    readonly installed: { port: number; chain: string }[] = [];
    available = true;

    async ensureRunning(port: number): Promise<boolean> {
        this.started.push(port);

        return this.available;
    }

    async install(port: number, certificate: { chain: string; key: string }): Promise<boolean> {
        this.installed.push({ port, chain: certificate.chain });

        return this.available;
    }
}

export class MemoryTlsStore implements TlsStore {
    material: { chain: string; key: string } | null = null;

    constructor(
        private settings: TlsSettingsState = { enabled: false, port: 3443, hasCertificate: false },
    ) {}

    async read(): Promise<TlsSettingsState> {
        return { ...this.settings };
    }

    async save(settings: TlsSettings, certificate?: { chain: string; key: string }): Promise<void> {
        this.settings = settings.snapshot();
        this.material = certificate ?? this.material;
    }
}

export class SettableClock implements Clock {
    constructor(public time = new Date('2026-11-08T10:00:00.000Z')) {}

    now(): Date {
        return new Date(this.time);
    }
}

// Runs the background work at once and lets the test wait for it.
export class AwaitableBackground implements BackgroundTasks {
    private readonly tasks: Promise<void>[] = [];

    run(task: () => Promise<void>): void {
        this.tasks.push(task());
    }

    async settled(): Promise<void> {
        await Promise.all(this.tasks);
    }
}

export class FixedLocalAddress implements LocalAddressReader {
    async current(): Promise<string | null> {
        return '192.168.1.99';
    }
}

export class MemoryKeepAwake implements KeepAwakeStore, KeepAwakeRuntime {
    readonly applied: boolean[] = [];
    private enabled = false;

    async read(): Promise<boolean> {
        return this.enabled;
    }

    async save(enabled: boolean): Promise<void> {
        this.enabled = enabled;
    }

    apply(enabled: boolean): void {
        this.applied.push(enabled);
    }
}

export class InternetAccessDoubles {
    static setup(initial?: InternetAccessState, tls?: TlsSettingsState) {
        const clock = new SettableClock();
        const store = new MemoryInternetAccessStore(initial);
        const router = new FakeRouter();
        const probe = new FakeProbe();
        const authority = new FakeAuthority(clock);
        const https = new FakeHttpsRuntime();
        const tlsStore = new MemoryTlsStore(tls);
        const setup = new InternetAccessSetup(
            store,
            router,
            probe,
            authority,
            https,
            tlsStore,
            clock,
        );

        return {
            clock,
            store,
            router,
            probe,
            authority,
            https,
            tls: tlsStore,
            setup,
            background: new AwaitableBackground(),
        };
    }

    // A state with a certificate issued at the clock's start, through UPnP.
    static active(overrides: Partial<InternetAccessState> = {}): InternetAccessState {
        return {
            ...InternetAccess.off().snapshot,
            phase: 'active',
            mapping: 'upnp',
            publicAddress,
            certificate: {
                address: publicAddress,
                issuedAt: '2026-11-08T10:00:00.000Z',
                expiresAt: '2026-11-15T02:00:00.000Z',
            },
            ...overrides,
        };
    }
}
