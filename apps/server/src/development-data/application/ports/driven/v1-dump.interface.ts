import type { V1Book, V1Corrections } from '../../../domain/services/v1-library-planner.service.js';

// The V1 (MongoDB) backup and the local corrections kept beside it.
export interface V1Dump {
    read(): Promise<{ books: V1Book[]; corrections: V1Corrections }>;
}
