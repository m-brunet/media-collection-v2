import type { ErasedLibrary } from '../driven/library-eraser.interface.js';

// What a development data reset removed.
export type ResetReport = ErasedLibrary & { removedCoverFiles: number };

export interface ResetDevelopmentDataUseCase {
    // Deletes the library and the audit log, keeping the accounts and the server settings.
    execute(): Promise<ResetReport>;
}
