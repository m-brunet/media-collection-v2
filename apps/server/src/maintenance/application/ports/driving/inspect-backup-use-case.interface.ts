import type { BackupDescription } from '../../backup-description.js';

export interface InspectBackupUseCase {
    execute(source: string): Promise<BackupDescription>;
}
