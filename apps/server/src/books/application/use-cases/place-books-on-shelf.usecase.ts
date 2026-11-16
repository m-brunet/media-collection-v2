import type {
    PlaceBooksOnShelfUseCase,
    ShelfPlacementRequest,
    ShelfPlacementView,
} from '../ports/driving/place-books-on-shelf-use-case.interface.js';
import { BookAudit } from '../book-audit.js';
import { BookSnapshot } from '../book-snapshot.helper.js';
import type { ShelfLocator } from '../ports/driven/shelf-locator.interface.js';
import type { BookLoader } from '../services/book-loader.service.js';
import type { BookOrganiser } from '../services/book-organiser.service.js';
import type { Book } from '../../domain/entities/book.entity.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class PlaceBooksOnShelf implements PlaceBooksOnShelfUseCase {
    static readonly maximumBooks = 100;

    constructor(
        private readonly loader: BookLoader,
        private readonly shelves: ShelfLocator,
        private readonly organiser: BookOrganiser,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, request: ShelfPlacementRequest): Promise<ShelfPlacementView> {
        return this.operations.run(
            {
                category: BookAudit.booksPlaced,
                actorId: actor.id,
                subjectType: BookAudit.shelf,
                subjectId: request.shelfId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const bookIds = [...new Set(request.bookIds)];

                Failure.ensure(
                    bookIds.length >= 1 && bookIds.length <= PlaceBooksOnShelf.maximumBooks,
                    'Choose between 1 and ' + PlaceBooksOnShelf.maximumBooks + ' books.',
                    'shelf-placement-size',
                );
                const shelf = await this.shelves.locate(request.shelfId);
                const books = await this.owned(bookIds);
                const view: ShelfPlacementView = { shelf, placed: [], moved: [], unchanged: [] };
                const related: RelatedChange[] = [];

                for (const book of books) {
                    related.push(...(await this.place(book, view)));
                }

                return {
                    result: view,
                    before: {
                        name: shelf.shelfName,
                        bookcaseName: shelf.bookcaseName,
                        bookIds,
                    },
                    after: {
                        name: shelf.shelfName,
                        bookcaseName: shelf.bookcaseName,
                        placed: view.placed.map(({ id }) => id),
                        moved: view.moved.map(({ id }) => id),
                        unchanged: view.unchanged.map(({ id }) => id),
                    },
                    related,
                };
            },
        );
    }

    private async owned(bookIds: readonly string[]): Promise<Book[]> {
        const books: Book[] = [];

        for (const id of bookIds) {
            const book = await this.loader.load(id);

            if (book.snapshot.details.ownership !== 'owned') {
                throw new Failure(
                    'invalid_input',
                    'Only Owned books can be placed on a shelf here.',
                    'book-not-owned',
                    { bookId: id },
                );
            }

            books.push(book);
        }

        return books;
    }

    private async place(book: Book, view: ShelfPlacementView): Promise<RelatedChange[]> {
        const { id } = book;
        const title = book.snapshot.details.title;
        const before = await this.organiser.current(id);

        if (before.location?.shelfId === view.shelf.shelfId) {
            view.unchanged.push({ id, title });

            return [];
        }

        const { organisation, changes } = await this.organiser.apply(id, {
            shelfId: view.shelf.shelfId,
        });

        if (before.location) {
            view.moved.push({ id, title, from: before.location });
        } else {
            view.placed.push({ id, title });
        }

        return [
            {
                category: BookAudit.organised,
                subjectType: BookAudit.book,
                subjectId: id,
                before: { title, ...BookSnapshot.organisation(before) },
                after: { title, ...BookSnapshot.organisation(organisation) },
            },
            ...changes,
        ];
    }
}
