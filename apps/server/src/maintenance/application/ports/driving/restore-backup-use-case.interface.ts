import type { BackupDescription } from '../../backup-description.js';

export interface RestoreBackupUseCase {
    execute(source: string): Promise<BackupDescription>;
}
