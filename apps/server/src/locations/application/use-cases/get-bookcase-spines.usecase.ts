import type { BookcaseSpineReader } from '../ports/driven/bookcase-spine-reader.interface.js';
import type { ShelfRepository } from '../ports/driven/shelf-repository.interface.js';
import type { GetBookcaseSpinesUseCase } from '../ports/driving/get-bookcase-spines-use-case.interface.js';
import type { BookcaseSpinesView } from '../location-views.js';
import type { LocationLoader } from '../services/location-loader.service.js';
import type { LocationViewer } from '../services/location-viewer.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class GetBookcaseSpines implements GetBookcaseSpinesUseCase {
    constructor(
        private readonly loader: LocationLoader,
        private readonly shelves: ShelfRepository,
        private readonly viewer: LocationViewer,
        private readonly spines: BookcaseSpineReader,
    ) {}

    async execute(actor: Actor, bookcaseId: string): Promise<BookcaseSpinesView> {
        ActorAuthorization.requireReady(actor);
        const bookcase = await this.loader.bookcase(bookcaseId);
        const { shelves } = this.viewer.bookcase(
            bookcase,
            await this.shelves.ofBookcase(bookcase.id),
            new Map(),
        );
        const books = await this.spines.booksOn(shelves.map((shelf) => shelf.id));

        return {
            bookcaseId: bookcase.id,
            shelves: shelves.map((shelf) => ({
                shelfId: shelf.id,
                books: books.get(shelf.id) ?? [],
            })),
        };
    }
}
