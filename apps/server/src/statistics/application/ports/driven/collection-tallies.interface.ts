import type { CollectionTally } from '../../../domain/services/collection-progress.service.js';

export interface CollectionTallies {
    all(): Promise<CollectionTally[]>;
}
