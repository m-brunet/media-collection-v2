import type { BackupDescription } from '../../backup-description.js';

export interface CreateBackupUseCase {
    execute(destination: string): Promise<BackupDescription>;
}
