import type { ErasedLibrary } from '../driven/library-eraser.interface.js';

export type ResetReport = ErasedLibrary & { removedCoverFiles: number };

export interface ResetDevelopmentDataUseCase {
    execute(): Promise<ResetReport>;
}
