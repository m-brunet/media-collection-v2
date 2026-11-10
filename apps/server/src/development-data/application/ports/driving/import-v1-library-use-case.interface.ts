import type { ErasedLibrary } from '../driven/library-eraser.interface.js';
import type { UnfinishedCollection } from '../../../domain/services/v1-library-planner.service.js';

export type V1ImportReport = {
    erased: ErasedLibrary;
    books: number;
    collections: number;
    finished: string[];
    unfinished: UnfinishedCollection[];
    // Untitled V1 Books, saved with their collection title as a supplied title.
    titled: { record: number; title: string }[];
    coversStored: number;
    coversSkipped: { record: number; title: string; reason: 'unavailable' | 'unusable' }[];
};

export interface ImportV1LibraryUseCase {
    // Replaces the whole library with the V1 dump, atomically.
    execute(): Promise<V1ImportReport>;
}
