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
import { PrivateStorage } from '../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';
import { CreateBackup } from '../../maintenance/application/use-cases/create-backup.usecase.js';
import type { BackupDescription } from '../../maintenance/application/backup-description.js';
import { DataDirectoryFiles } from '../../maintenance/infrastructure/adapters/driven/filesystem/data-directory-files.adapter.js';
import { ZipBackupArchive } from '../../maintenance/infrastructure/adapters/driven/filesystem/zip-backup-archive.adapter.js';
import { Sha256Checksums } from '../../maintenance/infrastructure/adapters/driven/runtime/sha256-checksums.adapter.js';
import { DatabaseSession } from '../../maintenance/infrastructure/adapters/driven/persistence/database-session.adapter.js';
import { KyselyLibraryContents } from '../../maintenance/infrastructure/adapters/driven/persistence/kysely-library-contents.adapter.js';
import { InspectBackup } from '../../maintenance/application/use-cases/inspect-backup.usecase.js';
import { RestoreBackup } from '../../maintenance/application/use-cases/restore-backup.usecase.js';
import { BackupReader } from '../../maintenance/application/services/backup-reader.service.js';
import { RestoredDataCheck } from '../../maintenance/infrastructure/adapters/driven/persistence/restored-data-check.adapter.js';
import { SessionSigningKey } from '../../identity/infrastructure/adapters/driven/filesystem/session-signing-key.adapter.js';
import { SessionSigningKeyRotation } from '../../identity/infrastructure/adapters/driven/filesystem/session-signing-key-rotation.adapter.js';
import { KyselyMaintenanceJournal } from '../../maintenance/infrastructure/adapters/driven/persistence/kysely-maintenance-journal.adapter.js';

export interface MaintenanceStatus {
    administrator: string | null;
    hasData: boolean;
}

export class LocalMaintenance {
    private readonly ids = new UuidGenerator();
    private readonly clock = new SystemClock();
    private readonly storage = new PrivateStorage();
    private readonly session: DatabaseSession;

    constructor(
        private readonly dataDirectory: string,
        private readonly version: string,
    ) {
        this.session = new DatabaseSession(dataDirectory, this.ids);
    }

    async status(): Promise<MaintenanceStatus> {
        if (!Database.exists(this.dataDirectory)) {
            return { administrator: null, hasData: false };
        }

        return this.session.use(async (connections) => {
            const administrator = await new FindProtectedAdministrator(
                new KyselyUserRepository(connections),
            ).execute();

            return { administrator: administrator?.username ?? null, hasData: true };
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

        return this.session.use((connections) =>
            new RecoverAdministrator(
                new KyselyUserRepository(connections),
                new ScryptPasswordHasher(),
                new AuditedOperation(
                    connections,
                    new KyselyAuditTrail(connections, this.ids),
                    this.clock,
                    this.ids,
                ),
            ).execute(password),
        );
    }

    createBackup(destination: string): Promise<BackupDescription> {
        return new CreateBackup(
            this.files(),
            new KyselyLibraryContents(this.session),
            new ZipBackupArchive(this.storage),
            new Sha256Checksums(),
            this.journal(),
            this.clock,
            this.version,
        ).execute(destination);
    }

    inspectBackup(source: string): Promise<BackupDescription> {
        return new InspectBackup(this.backups()).execute(source);
    }

    restoreBackup(source: string): Promise<BackupDescription> {
        return new RestoreBackup(
            this.backups(),
            this.files(),
            new SessionSigningKeyRotation(new SessionSigningKey(this.storage), this.dataDirectory),
            this.journal(),
        ).execute(source);
    }

    private backups(): BackupReader {
        return new BackupReader(
            new ZipBackupArchive(this.storage),
            new Sha256Checksums(),
            this.version,
        );
    }

    private files(): DataDirectoryFiles {
        return new DataDirectoryFiles(this.dataDirectory, new RestoredDataCheck(this.ids));
    }

    private journal(): KyselyMaintenanceJournal {
        return new KyselyMaintenanceJournal(this.session, this.ids, this.clock);
    }
}
