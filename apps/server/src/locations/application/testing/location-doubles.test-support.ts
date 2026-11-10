import type { BookShelfStore } from '../ports/driven/book-shelf-store.interface.js';
import type { BookcaseRepository } from '../ports/driven/bookcase-repository.interface.js';
import type { ShelfRepository } from '../ports/driven/shelf-repository.interface.js';
import { BookShelfAssignment } from '../services/book-shelf-assignment.service.js';
import { LocationLoader } from '../services/location-loader.service.js';
import { LocationNaming } from '../services/location-naming.service.js';
import { LocationOverview } from '../services/location-overview.service.js';
import { LocationViewer } from '../services/location-viewer.service.js';
import { Bookcase } from '../../domain/entities/bookcase.entity.js';
import { Shelf } from '../../domain/entities/shelf.entity.js';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';

export class MemoryBookcases implements BookcaseRepository {
    readonly bookcases = new Map<string, Bookcase>();

    constructor(private readonly shelves: MemoryShelves) {}

    async findById(id: string): Promise<Bookcase | null> {
        const bookcase = this.bookcases.get(id);

        return bookcase ? new Bookcase(bookcase.snapshot) : null;
    }

    async findByKey(key: string): Promise<Bookcase | null> {
        const bookcase = [...this.bookcases.values()].find((value) => value.key === key);

        return bookcase ? new Bookcase(bookcase.snapshot) : null;
    }

    async list(): Promise<Bookcase[]> {
        return [...this.bookcases.values()].map((bookcase) => new Bookcase(bookcase.snapshot));
    }

    async create(bookcase: Bookcase): Promise<void> {
        if (await this.findByKey(bookcase.key)) {
            throw new Failure('conflict', 'Equivalent bookcase', 'bookcase-name-taken');
        }

        this.bookcases.set(bookcase.id, new Bookcase(bookcase.snapshot));
    }

    async save(bookcase: Bookcase): Promise<void> {
        this.bookcases.set(bookcase.id, new Bookcase(bookcase.snapshot));
    }

    async delete(id: string): Promise<void> {
        this.bookcases.delete(id);

        for (const shelf of await this.shelves.ofBookcase(id)) {
            await this.shelves.delete(shelf.id);
        }
    }
}

export class MemoryShelves implements ShelfRepository {
    readonly shelves = new Map<string, Shelf>();

    constructor(private readonly store: MemoryBookShelves) {}

    async findById(id: string): Promise<Shelf | null> {
        const shelf = this.shelves.get(id);

        return shelf ? new Shelf(shelf.snapshot) : null;
    }

    async findByKey(bookcaseId: string, key: string): Promise<Shelf | null> {
        const shelf = [...this.shelves.values()].find(
            (value) => value.snapshot.bookcaseId === bookcaseId && value.key === key,
        );

        return shelf ? new Shelf(shelf.snapshot) : null;
    }

    async list(): Promise<Shelf[]> {
        return [...this.shelves.values()].map((shelf) => new Shelf(shelf.snapshot));
    }

    async ofBookcase(bookcaseId: string): Promise<Shelf[]> {
        return (await this.list()).filter((shelf) => shelf.snapshot.bookcaseId === bookcaseId);
    }

    async create(shelf: Shelf): Promise<void> {
        if (await this.findByKey(shelf.snapshot.bookcaseId, shelf.key)) {
            throw new Failure('conflict', 'Equivalent shelf', 'shelf-name-taken');
        }

        this.shelves.set(shelf.id, new Shelf(shelf.snapshot));
    }

    async save(shelf: Shelf): Promise<void> {
        this.shelves.set(shelf.id, new Shelf(shelf.snapshot));
    }

    async delete(id: string): Promise<void> {
        this.shelves.delete(id);

        for (const [bookId, shelfId] of this.store.shelves) {
            if (shelfId === id) {
                this.store.shelves.delete(bookId);
            }
        }
    }
}

export class MemoryBookShelves implements BookShelfStore {
    readonly shelves = new Map<string, string>();

    async shelfOf(bookId: string): Promise<string | null> {
        return this.shelves.get(bookId) ?? null;
    }

    async place(bookId: string, shelfId: string): Promise<void> {
        this.shelves.set(bookId, shelfId);
    }

    async remove(bookId: string): Promise<void> {
        this.shelves.delete(bookId);
    }

    async countByShelf(): Promise<Map<string, number>> {
        const counts = new Map<string, number>();

        for (const shelfId of this.shelves.values()) {
            counts.set(shelfId, (counts.get(shelfId) ?? 0) + 1);
        }

        return counts;
    }
}

export class LocationDoubles {
    static furniture() {
        const store = new MemoryBookShelves();
        const shelves = new MemoryShelves(store);
        const bookcases = new MemoryBookcases(shelves);
        const trail = new MemoryAuditTrail();
        const loader = new LocationLoader(bookcases, shelves);
        let counter = 0;

        return {
            bookcases,
            shelves,
            store,
            trail,
            loader,
            ids: { next: () => 'location-' + ++counter },
            clock: { now: () => new Date('2026-03-01T10:00:00Z') },
            naming: new LocationNaming(bookcases, shelves),
            overview: new LocationOverview(bookcases, shelves, store, new LocationViewer()),
            operations: AuditDoubles.auditedOperation(trail),
            assignment: new BookShelfAssignment(store, loader),
        };
    }

    static async withShelf(
        current: ReturnType<typeof LocationDoubles.furniture>,
        bookcaseName: string,
        shelfName: string | null,
    ) {
        const existing = [...current.bookcases.bookcases.values()].find(
            (value) => value.snapshot.name === bookcaseName,
        );
        const bookcase =
            existing ??
            new Bookcase({
                id: current.ids.next(),
                name: bookcaseName,
                createdAt: at,
                updatedAt: at,
            });

        if (!existing) {
            await current.bookcases.create(bookcase);
        }

        const shelf = shelfName
            ? new Shelf({
                  id: current.ids.next(),
                  bookcaseId: bookcase.id,
                  name: shelfName,
                  createdAt: at,
                  updatedAt: at,
              })
            : null;

        if (shelf) {
            await current.shelves.create(shelf);
        }

        return { bookcase, shelf: shelf! };
    }

    static async placed(
        current: ReturnType<typeof LocationDoubles.furniture>,
        bookId: string,
        shelfId: string,
    ) {
        await current.store.place(bookId, shelfId);
    }
}

const at = '2026-01-01T00:00:00.000Z';

export const owner = TestActors.of('owner', 'camille');
export const guest = TestActors.of('guest', 'morgan');
