import type { PasswordHasher } from '../../../apps/server/src/identity/application/ports/driven/password-hasher.interface.js';
import type { UserRepository } from '../../../apps/server/src/identity/application/ports/driven/user-repository.interface.js';
import type { NoteRepository } from '../../../apps/server/src/notes/application/ports/driven/note-repository.interface.js';
import type { TlsStore } from '../../../apps/server/src/server-settings/application/ports/driven/tls-store.interface.js';
import type { HttpSettingsStore } from '../../../apps/server/src/server-settings/application/ports/driven/http-settings-store.interface.js';

export interface TestAppContext {
    users: UserRepository;
    passwords: PasswordHasher;
    notes: NoteRepository;
    tls: TlsStore;
    http: HttpSettingsStore;
}
