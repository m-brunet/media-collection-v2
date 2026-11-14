import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import { HttpInternetAccess } from '../../domain/entities/http-internet-access.entity.js';
import type { HttpInternetAccessState } from '../../domain/entities/http-internet-access.entity.js';
import type { InternetAccessState } from '../../domain/entities/internet-access.entity.js';
import type {
    TlsSettings,
    TlsSettingsState,
} from '../../domain/value-objects/tls-settings.value-object.js';
import type { BackgroundTasks } from '../ports/driven/background-tasks.interface.js';
import type {
    CertificateAuthority,
    CertificateIssue,
    CertificateSubject,
} from '../ports/driven/certificate-authority.interface.js';
import type { DomainNameResolver } from '../ports/driven/domain-name-resolver.interface.js';
import type { DomainNameStore } from '../ports/driven/domain-name-store.interface.js';
import type { EventLog } from '../ports/driven/event-log.interface.js';
import type { DomainName } from '../../domain/value-objects/domain-name.value-object.js';
import type { HttpsRuntime } from '../ports/driven/https-runtime.interface.js';
import type { HttpInternetAccessStore } from '../ports/driven/http-internet-access-store.interface.js';
import type { HttpListener } from '../ports/driven/http-listener.interface.js';
import type { InternetAccessStore } from '../ports/driven/internet-access-store.interface.js';
import type { KeepAwakeRuntime } from '../ports/driven/keep-awake-runtime.interface.js';
import type { KeepAwakeStore } from '../ports/driven/keep-awake-store.interface.js';
import type { LocalAddressReader } from '../ports/driven/local-address-reader.interface.js';
import type { PublicAddressProbe } from '../ports/driven/public-address-probe.interface.js';
import type { PortRule } from '../ports/driven/port-rule.interface.js';
import type { RouterConnection } from '../ports/driven/router-connection.interface.js';
import type { RouterGateway } from '../ports/driven/router-gateway.interface.js';
import type { TlsCertificateReader } from '../ports/driven/tls-certificate-reader.interface.js';
import type { TlsStore } from '../ports/driven/tls-store.interface.js';
import { CheckPortWindow } from '../services/check-port-window.service.js';
import { DomainNameCheck } from '../services/domain-name-check.service.js';
import { HttpInternetAccessClosing } from '../services/http-internet-access-closing.service.js';
import { HttpPortForwarding } from '../services/http-port-forwarding.service.js';
import { InternetAccessSetup } from '../services/internet-access-setup.service.js';
import { RouterRules } from '../services/router-rules.service.js';

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

export class MemoryHttpInternetAccessStore implements HttpInternetAccessStore {
    constructor(private state: HttpInternetAccessState = HttpInternetAccess.off().snapshot) {}

    async read(): Promise<HttpInternetAccess> {
        return new HttpInternetAccess(this.state);
    }

    async save(access: HttpInternetAccess): Promise<void> {
        this.state = access.snapshot;
    }

    get current(): HttpInternetAccessState {
        return structuredClone(this.state);
    }
}

export class FixedHttpListener implements HttpListener {
    constructor(private readonly running = 34345) {}

    port(): number {
        return this.running;
    }
}

export class MemoryEventLog implements EventLog {
    readonly lines: string[] = [];

    write(line: string): void {
        this.lines.push(line);
    }
}

export class FakeRouter implements RouterGateway {
    readonly opened: PortRule[] = [];
    readonly closed: PortRule[] = [];
    refusedPorts: number[] = [];

    constructor(
        public connection: RouterConnection | null = {
            mapping: 'upnp',
            externalAddress: publicAddress,
        },
        public accepts = true,
        private readonly journal: string[] = [],
    ) {}

    async find(): Promise<RouterConnection | null> {
        return this.connection ? { ...this.connection } : null;
    }

    async open(rule: PortRule): Promise<boolean> {
        const accepted = this.accepts && !this.refusedPorts.includes(rule.externalPort);

        if (accepted) {
            this.opened.push(rule);
            this.journal.push('open ' + rule.externalPort + ' -> ' + rule.internalPort);
        }

        return accepted;
    }

    async close(rule: PortRule): Promise<void> {
        this.closed.push(rule);
        this.journal.push('close ' + rule.externalPort);
    }
}

export class FakeProbe implements PublicAddressProbe {
    constructor(public address: string | null = publicAddress) {}

    async current(): Promise<string | null> {
        return this.address;
    }
}

export class FakeResolver implements DomainNameResolver {
    readonly asked: string[] = [];

    constructor(public answer: string[] = [publicAddress]) {}

    async addresses(name: string): Promise<string[]> {
        this.asked.push(name);

        return [...this.answer];
    }
}

export class MemoryDomainNameStore implements DomainNameStore {
    constructor(public name: string | null = null) {}

    async read(): Promise<string | null> {
        return this.name;
    }

    async save(name: DomainName | null): Promise<void> {
        this.name = name ? name.value : null;
    }
}

export class FakeAuthority implements CertificateAuthority {
    readonly requested: string[] = [];
    readonly subjects: CertificateSubject[] = [];
    readonly replaced: (string | null)[] = [];
    refusal: Extract<CertificateIssue, { outcome: 'refused' }>['reason'] | null = null;
    failure: Error | null = null;
    retryAfter: string | null = null;

    constructor(
        private readonly clock: Clock,
        private readonly journal: string[] = [],
    ) {}

    async issue(subject: CertificateSubject, replacing: string | null): Promise<CertificateIssue> {
        const address = subject.name;

        this.journal.push('check ' + address);
        this.requested.push(address);
        this.subjects.push({ ...subject });
        this.replaced.push(replacing);

        if (this.failure) {
            throw this.failure;
        }

        if (this.refusal === 'rate-limited') {
            return { outcome: 'refused', reason: 'rate-limited', retryAfter: this.retryAfter };
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
            renewal: replacing !== null,
        };
    }
}

export class FakeHttpsRuntime implements HttpsRuntime {
    readonly started: number[] = [];
    readonly installed: { port: number; chain: string }[] = [];
    available = true;
    running: number | null = null;

    runningPort(): number | null {
        return this.running;
    }

    async ensureRunning(port: number): Promise<boolean> {
        this.started.push(port);

        return this.available;
    }

    async install(port: number, certificate: { chain: string; key: string }): Promise<boolean> {
        this.installed.push({ port, chain: certificate.chain });

        return this.available;
    }
}

export class MemoryTlsStore implements TlsStore, TlsCertificateReader {
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

    async currentChain(): Promise<string | null> {
        return this.material?.chain ?? null;
    }
}

export class SettableClock implements Clock {
    constructor(public time = new Date('2026-11-08T10:00:00.000Z')) {}

    now(): Date {
        return new Date(this.time);
    }
}

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
        const journal: string[] = [];
        const log = new MemoryEventLog();
        const store = new MemoryInternetAccessStore(initial);
        const router = new FakeRouter(undefined, undefined, journal);
        const probe = new FakeProbe();
        const authority = new FakeAuthority(clock, journal);
        const https = new FakeHttpsRuntime();
        const tlsStore = new MemoryTlsStore(tls);
        const resolver = new FakeResolver();
        const domains = new DomainNameCheck(resolver);
        const names = new MemoryDomainNameStore();
        const httpStore = new MemoryHttpInternetAccessStore();
        const httpListener = new FixedHttpListener();
        const rules = new RouterRules(router, probe);
        const forwarding = new HttpPortForwarding(rules, httpListener, clock);
        const window = new CheckPortWindow(rules, log);
        const setup = new InternetAccessSetup(
            store,
            rules,
            authority,
            https,
            tlsStore,
            domains,
            names,
            new HttpInternetAccessClosing(httpStore, forwarding),
            window,
            clock,
        );

        return {
            clock,
            journal,
            log,
            window,
            store,
            router,
            probe,
            rules,
            authority,
            https,
            tls: tlsStore,
            resolver,
            domains,
            names,
            http: httpStore,
            httpListener,
            forwarding,
            setup,
            background: new AwaitableBackground(),
        };
    }

    static httpOpen(): HttpInternetAccessState {
        return {
            ...HttpInternetAccess.off().snapshot,
            phase: 'open',
            mapping: 'upnp',
            publicAddress,
        };
    }

    static active(overrides: Partial<InternetAccessState> = {}): InternetAccessState {
        return {
            ...InternetAccess.off().snapshot,
            phase: 'active',
            mapping: 'upnp',
            publicAddress,
            routerPort: 3443,
            certificate: {
                address: publicAddress,
                issuedAt: '2026-11-08T10:00:00.000Z',
                expiresAt: '2026-11-15T02:00:00.000Z',
            },
            ...overrides,
        };
    }
}
