import type { AppearanceStore } from '../../../apps/server/src/appearance/application/ports/driven/appearance-store.interface.js';
import type { BooksDependencies } from '../../../apps/server/src/books/infrastructure/config/books.module.js';
import type { AuditLogProbe } from './audit-log-probe.js';
import type { LibraryProbe } from './library-probe.js';
import type { TestLibrary } from '../fixtures/test-library.js';
import type { ScriptedLookupSources } from '../fixtures/scripted-lookup-sources.js';
import type { LoanRepository } from '../../../apps/server/src/lending/application/ports/driven/loan-repository.interface.js';
import type { ReceiverRepository } from '../../../apps/server/src/lending/application/ports/driven/receiver-repository.interface.js';
import type { PasswordHasher } from '../../../apps/server/src/identity/application/ports/driven/password-hasher.interface.js';
import type { UserRepository } from '../../../apps/server/src/identity/application/ports/driven/user-repository.interface.js';
import type { TlsStore } from '../../../apps/server/src/server-settings/application/ports/driven/tls-store.interface.js';
import type { HttpSettingsStore } from '../../../apps/server/src/server-settings/application/ports/driven/http-settings-store.interface.js';
import type { InternetAccessStore } from '../../../apps/server/src/server-settings/application/ports/driven/internet-access-store.interface.js';
import type { DomainNameStore } from '../../../apps/server/src/server-settings/application/ports/driven/domain-name-store.interface.js';
import type {
    AwaitableBackground,
    FakeAuthority,
    FakeHttpsRuntime,
    FakeProbe,
    FakeResolver,
    FakeRouter,
    MemoryKeepAwake,
} from '../../../apps/server/src/server-settings/application/testing/internet-access-doubles.test-support.js';

export interface TestAppContext {
    users: UserRepository;
    passwords: PasswordHasher;
    tls: TlsStore;
    http: HttpSettingsStore;
    appearance: AppearanceStore;
    books: Omit<
        BooksDependencies,
        | 'ids'
        | 'clock'
        | 'operations'
        | 'collections'
        | 'collectionReader'
        | 'shelves'
        | 'locationReader'
        | 'tags'
        | 'tagReader'
        | 'loans'
        | 'loanHistory'
        | 'lookup'
    > & { lookup: ScriptedLookupSources };
    audit: AuditLogProbe;
    library: LibraryProbe;
    lending: { loans: LoanRepository; receivers: ReceiverRepository };
    // Builds and saves entities through the repositories above, to arrange scenarios.
    builders: TestLibrary;
    // Stand-ins for the router, Let's Encrypt, the public address service and the HTTPS listener;
    // `background.settled()` waits for a setup started by a request.
    internetAccess: {
        store: InternetAccessStore;
        domainName: DomainNameStore;
        router: FakeRouter;
        authority: FakeAuthority;
        probe: FakeProbe;
        resolver: FakeResolver;
        https: FakeHttpsRuntime;
        background: AwaitableBackground;
        keepAwake: MemoryKeepAwake;
    };
}
