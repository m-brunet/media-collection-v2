import type { ErasedLibrary } from '../driven/library-eraser.interface.js';

export type ResetReport = ErasedLibrary & { removedCoverFiles: number };

export interface ResetDevelopmentDataUseCase {
    // Deletes the library and the audit log, keeping the accounts and the server settings.
    execute(): Promise<ResetReport>;
}
