import type { CollectionVolumesView } from './ports/driven/collection-volumes.interface.js';
import { Failure } from '../../shared/domain/exceptions/failure.js';

export class VolumeAdmission {
    static ensureOpen(collection: Pick<CollectionVolumesView, 'status'>): void {
        if (collection.status === 'finished') {
            throw new Failure(
                'conflict',
                'Mark the collection unfinished before adding volumes.',
                'collection-finished',
            );
        }

        if (collection.status === 'dropped') {
            throw new Failure(
                'conflict',
                'Resume the collection before adding volumes.',
                'collection-dropped',
            );
        }
    }
}
