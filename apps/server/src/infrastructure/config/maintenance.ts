import { Database } from '../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { KyselyAuditTrail } from '../../shared/infrastructure/adapters/driven/persistence/kysely-audit-trail.adapter.js';
import { SystemClock } from '../../shared/infrastructure/adapters/driven/runtime/system-clock.adapter.js';
import { UuidGenerator } from '../../shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { AuditedOperation } from '../../shared/application/services/audited-operation.service.js';
import { KyselyUserRepository } from '../../identity/infrastructure/adapters/driven/persistence/kysely-user.repository.js';
import { ScryptPasswordHasher } from '../../identity/infrastructure/adapters/driven/security/scrypt-password-hasher.adapter.js';
import { RecoverAdministrator } from '../../identity/application/use-cases/recover-administrator.usecase.js';
import { FindProtectedAdministrator } from '../../identity/application/use-cases/find-protected-administrator.usecase.js';
import { Failure } from '../../shared/domain/exceptions/failure.js';

export interface MaintenanceStatus {
    administrator: string | null;
}

// Local host maintenance, run by the Electron worker while no HTTP listener is active. An
// installation without a database stays without one, except for a restore.
export class LocalMaintenance {
    private readonly ids = new UuidGenerator();
    private readonly clock = new SystemClock();

    constructor(private readonly dataDirectory: string) {}

    async status(): Promise<MaintenanceStatus> {
        if (!Database.exists(this.dataDirectory)) {
            return { administrator: null };
        }

        return this.withDatabase(async (database) => {
            const administrator = await new FindProtectedAdministrator(
                new KyselyUserRepository(database.connections),
            ).execute();

            return { administrator: administrator?.username ?? null };
        });
    }

    async recover(password: string): Promise<{ username: string }> {
        if (!Database.exists(this.dataDirectory)) {
            throw new Failure(
                'not_found',
                'There is no administrator account yet.',
                'administrator-missing',
            );
        }

        return this.withDatabase((database) =>
            new RecoverAdministrator(
                new KyselyUserRepository(database.connections),
                new ScryptPasswordHasher(),
                this.operations(database),
            ).execute(password),
        );
    }

    private operations(database: Database): AuditedOperation {
        return new AuditedOperation(
            database.connections,
            new KyselyAuditTrail(database.connections, this.ids),
            this.clock,
            this.ids,
        );
    }

    private async withDatabase<T>(work: (database: Database) => Promise<T>): Promise<T> {
        const database = await Database.open(this.dataDirectory, this.ids);

        try {
            return await work(database);
        } finally {
            await database.close();
        }
    }
}
