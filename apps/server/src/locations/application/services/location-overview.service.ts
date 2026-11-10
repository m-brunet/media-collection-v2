import type { BookcaseView, ShelfView } from '../location-views.js';
import type { BookcaseRepository } from '../ports/driven/bookcase-repository.interface.js';
import type { BookShelfStore } from '../ports/driven/book-shelf-store.interface.js';
import type { ShelfRepository } from '../ports/driven/shelf-repository.interface.js';
import { LocationViewer } from './location-viewer.service.js';
import type { Bookcase } from '../../domain/entities/bookcase.entity.js';
import type { Shelf } from '../../domain/entities/shelf.entity.js';

export class LocationOverview {
    constructor(
        private readonly bookcases: BookcaseRepository,
        private readonly shelves: ShelfRepository,
        private readonly store: BookShelfStore,
        private readonly viewer: LocationViewer,
    ) {}

    async all(): Promise<BookcaseView[]> {
        const shelves = await this.shelves.list();
        const counts = await this.store.countByShelf();

        return this.viewer.sorted(
            (await this.bookcases.list()).map((bookcase) =>
                this.viewer.bookcase(bookcase, shelves, counts),
            ),
        );
    }

    async bookcase(bookcase: Bookcase): Promise<BookcaseView> {
        return this.viewer.bookcase(
            bookcase,
            await this.shelves.ofBookcase(bookcase.id),
            await this.store.countByShelf(),
        );
    }

    async shelf(shelf: Shelf): Promise<ShelfView> {
        return this.viewer.shelf(shelf, await this.store.countByShelf());
    }
}
