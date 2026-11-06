import type { ErasedLibrary } from '../driven/library-eraser.interface.js';
import type { UnfinishedCollection } from '../../../domain/services/v1-library-planner.service.js';

// What a V1 import replaced and brought in.
export type V1ImportReport = {
    erased: ErasedLibrary;
    books: number;
    collections: number;
    finished: string[];
    unfinished: UnfinishedCollection[];
    coversStored: number;
    // Books saved without their V1 cover, with the reason.
    coversSkipped: { record: number; title: string; reason: 'unavailable' | 'unusable' }[];
};

export interface ImportV1LibraryUseCase {
    // Replaces the whole library with the V1 dump, atomically.
    execute(): Promise<V1ImportReport>;
}
