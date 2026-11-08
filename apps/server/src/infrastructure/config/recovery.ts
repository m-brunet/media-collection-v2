import { Database } from '../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { KyselyUserRepository } from '../../identity/infrastructure/adapters/driven/persistence/kysely-user.repository.js';
import { ScryptPasswordHasher } from '../../identity/infrastructure/adapters/driven/security/scrypt-password-hasher.adapter.js';
import { RecoverAdministrator } from '../../identity/application/use-cases/recover-administrator.usecase.js';

// Local administrator recovery, run by the desktop on existing storage only. It never migrates,
// seeds users, or creates listeners.
export class AdministratorRecovery {
    static async run(dataDirectory: string, login: string, password: string): Promise<void> {
        const database = Database.openExisting(dataDirectory);

        try {
            await new RecoverAdministrator(
                new KyselyUserRepository(database.connections),
                new ScryptPasswordHasher(),
            ).execute(login, password);
        } finally {
            await database.close();
        }
    }
}
