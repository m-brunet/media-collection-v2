import type { BookcaseView, ShelfView } from '../location-views.js';
import type { Bookcase } from '../../domain/entities/bookcase.entity.js';
import type { Shelf } from '../../domain/entities/shelf.entity.js';

const order = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

// Bookcases and shelves with the number of books kept on them.
export class LocationViewer {
    bookcase(
        bookcase: Bookcase,
        shelves: readonly Shelf[],
        counts: ReadonlyMap<string, number>,
    ): BookcaseView {
        const views = shelves
            .filter((shelf) => shelf.snapshot.bookcaseId === bookcase.id)
            .map((shelf) => this.shelf(shelf, counts))
            .sort((first, second) => order.compare(first.name, second.name));

        return {
            id: bookcase.id,
            name: bookcase.snapshot.name,
            bookCount: views.reduce((total, shelf) => total + shelf.bookCount, 0),
            shelves: views,
        };
    }

    shelf(shelf: Shelf, counts: ReadonlyMap<string, number>): ShelfView {
        const { id, bookcaseId, name } = shelf.snapshot;

        return { id, bookcaseId, name, bookCount: counts.get(id) ?? 0 };
    }

    // Bookcases in name order, numbers compared by value.
    sorted(views: BookcaseView[]): BookcaseView[] {
        return views.sort((first, second) => order.compare(first.name, second.name));
    }
}
