import type { ErasedLibrary } from '../driven/library-eraser.interface.js';
import type { UnfinishedCollection } from '../../../domain/services/v1-library-planner.service.js';

export type V1ImportReport = {
    erased: ErasedLibrary;
    books: number;
    collections: number;
    finished: string[];
    unfinished: UnfinishedCollection[];
    titled: { record: number; title: string }[];
    coversStored: number;
    coversSkipped: { record: number; title: string; reason: 'unavailable' | 'unusable' }[];
};

export interface ImportV1LibraryUseCase {
    execute(): Promise<V1ImportReport>;
}
