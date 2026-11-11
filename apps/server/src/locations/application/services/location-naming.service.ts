import type { BookcaseRepository } from '../ports/driven/bookcase-repository.interface.js';
import type { ShelfRepository } from '../ports/driven/shelf-repository.interface.js';
import { LocationName } from '../../domain/value-objects/location-name.value-object.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export class LocationNaming {
    constructor(
        private readonly bookcases: BookcaseRepository,
        private readonly shelves: ShelfRepository,
    ) {}

    async ensureBookcaseAvailable(name: string, bookcaseId: string | null): Promise<void> {
        const equivalent = await this.bookcases.findByKey(
            NameKey.of(LocationName.of(name, 'bookcase')),
        );

        if (equivalent && equivalent.id !== bookcaseId) {
            throw new Failure(
                'conflict',
                'Another bookcase already has this name.',
                'bookcase-name-taken',
            );
        }
    }

    async ensureShelfAvailable(
        bookcaseId: string,
        name: string,
        shelfId: string | null,
    ): Promise<void> {
        const equivalent = await this.shelves.findByKey(
            bookcaseId,
            NameKey.of(LocationName.of(name, 'shelf')),
        );

        if (equivalent && equivalent.id !== shelfId) {
            throw new Failure(
                'conflict',
                'This bookcase already has a shelf with this name.',
                'shelf-name-taken',
            );
        }
    }
}
