import type { BookcaseRepository } from '../ports/driven/bookcase-repository.interface.js';
import type { ShelfRepository } from '../ports/driven/shelf-repository.interface.js';
import type { Bookcase } from '../../domain/entities/bookcase.entity.js';
import type { Shelf } from '../../domain/entities/shelf.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class LocationLoader {
    constructor(
        private readonly bookcases: BookcaseRepository,
        private readonly shelves: ShelfRepository,
    ) {}

    async bookcase(id: string): Promise<Bookcase> {
        const bookcase = await this.bookcases.findById(id);

        if (!bookcase) {
            throw new Failure('not_found', 'That bookcase does not exist.', 'bookcase-missing');
        }

        return bookcase;
    }

    async shelf(id: string): Promise<Shelf> {
        const shelf = await this.shelves.findById(id);

        if (!shelf) {
            throw new Failure('not_found', 'That shelf does not exist.', 'shelf-missing');
        }

        return shelf;
    }
}
