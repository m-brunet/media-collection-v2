import type { Actor } from '../domain/actor.helper.js';
import { Failure } from '../domain/exceptions/failure.js';

export type FilteredCategory = 'books' | 'manga' | 'comics';
export type FilteredOwnership = 'owned' | 'not-owned';

export interface BookFilterCriteria {
    categories: FilteredCategory[];
    authorIds: string[];
    collections: { ids: string[]; none: boolean };
    locations: { bookcaseIds: string[]; shelfIds: string[]; none: boolean };
    ownerships: FilteredOwnership[];
    // The reader's own status; only for a reader (never a Guest).
    reading: ('read' | 'unread')[];
    tags: { include: string[]; exclude: string[] };
}

// Advanced criteria on single books, shared by the book and collection listings. Different
// fields combine with AND, the choices within a field with OR; an empty field does not restrict.
// Every included tag must be present and any excluded tag rejects the book. `none` selects
// books without a collection or location.
export class BookFilter implements BookFilterCriteria {
    readonly categories: FilteredCategory[];
    readonly authorIds: string[];
    readonly collections: { ids: string[]; none: boolean };
    readonly locations: { bookcaseIds: string[]; shelfIds: string[]; none: boolean };
    readonly ownerships: FilteredOwnership[];
    readonly reading: ('read' | 'unread')[];
    readonly tags: { include: string[]; exclude: string[] };

    private constructor(criteria: BookFilterCriteria) {
        this.categories = criteria.categories;
        this.authorIds = criteria.authorIds;
        this.collections = criteria.collections;
        this.locations = criteria.locations;
        this.ownerships = criteria.ownerships;
        this.reading = criteria.reading;
        this.tags = criteria.tags;
    }

    // The given criteria; every field left out keeps every book.
    static of(criteria: Partial<BookFilterCriteria> = {}): BookFilter {
        return new BookFilter({
            categories: criteria.categories ?? [],
            authorIds: criteria.authorIds ?? [],
            collections: criteria.collections ?? { ids: [], none: false },
            locations: criteria.locations ?? { bookcaseIds: [], shelfIds: [], none: false },
            ownerships: criteria.ownerships ?? [],
            reading: criteria.reading ?? [],
            tags: criteria.tags ?? { include: [], exclude: [] },
        });
    }

    isEmpty(): boolean {
        return (
            this.categories.length === 0 &&
            this.authorIds.length === 0 &&
            this.collections.ids.length === 0 &&
            !this.collections.none &&
            this.locations.bookcaseIds.length === 0 &&
            this.locations.shelfIds.length === 0 &&
            !this.locations.none &&
            this.ownerships.length === 0 &&
            !this.usesReading() &&
            this.tags.include.length === 0 &&
            this.tags.exclude.length === 0
        );
    }

    usesReading(): boolean {
        return this.reading.length > 0;
    }

    readerFor(actor: Actor): string | null {
        if (actor.role !== 'guest') {
            return actor.id;
        }

        Failure.ensure(
            !this.usesReading(),
            'Guest accounts have no reading status to filter on.',
            'reading-filter-unavailable',
        );

        return null;
    }
}
