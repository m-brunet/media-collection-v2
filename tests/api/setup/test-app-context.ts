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
}
