import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ValueProviders } from '../../../shared/infrastructure/config/value-providers.helper.js';
import type { BookLocationReader } from '../../../books/application/ports/driven/book-location-reader.interface.js';
import type { ShelfAssignment } from '../../../books/application/ports/driven/shelf-assignment.interface.js';
import type { ShelfLocator } from '../../../books/application/ports/driven/shelf-locator.interface.js';
import type { BookShelfStore } from '../../application/ports/driven/book-shelf-store.interface.js';
import type { BookcaseRepository } from '../../application/ports/driven/bookcase-repository.interface.js';
import type { ShelfRepository } from '../../application/ports/driven/shelf-repository.interface.js';
import { BookShelfAssignment } from '../../application/services/book-shelf-assignment.service.js';
import { LocationLoader } from '../../application/services/location-loader.service.js';
import { LocationNaming } from '../../application/services/location-naming.service.js';
import { LocationOverview } from '../../application/services/location-overview.service.js';
import { LocationViewer } from '../../application/services/location-viewer.service.js';
import { ChangeShelf } from '../../application/use-cases/change-shelf.usecase.js';
import { CreateBookcase } from '../../application/use-cases/create-bookcase.usecase.js';
import { CreateShelf } from '../../application/use-cases/create-shelf.usecase.js';
import { DeleteBookcase } from '../../application/use-cases/delete-bookcase.usecase.js';
import { DeleteShelf } from '../../application/use-cases/delete-shelf.usecase.js';
import { ListBookcases } from '../../application/use-cases/list-bookcases.usecase.js';
import { RenameBookcase } from '../../application/use-cases/rename-bookcase.usecase.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { BookcasesController } from '../adapters/driving/web/bookcases.controller.js';
import { ShelvesController } from '../adapters/driving/web/shelves.controller.js';

export interface LocationsDependencies {
    bookcases: BookcaseRepository;
    shelves: ShelfRepository;
    store: BookShelfStore;
    ids: IdGenerator;
    clock: Clock;
    operations: AuditedOperation;
}

const token = {
    bookcases: 'LOCATIONS_BOOKCASES',
    shelves: 'LOCATIONS_SHELVES',
    store: 'LOCATIONS_BOOK_SHELVES',
    ids: 'LOCATIONS_IDS',
    clock: 'LOCATIONS_CLOCK',
    operations: 'LOCATIONS_AUDITED_OPERATION',
    loader: 'LOCATIONS_LOADER',
    naming: 'LOCATIONS_NAMING',
    overview: 'LOCATIONS_OVERVIEW',
} as const;
const serviceProviders: Provider[] = [
    {
        provide: token.loader,
        inject: [token.bookcases, token.shelves],
        useFactory: (bookcases: BookcaseRepository, shelves: ShelfRepository) =>
            new LocationLoader(bookcases, shelves),
    },
    {
        provide: token.naming,
        inject: [token.bookcases, token.shelves],
        useFactory: (bookcases: BookcaseRepository, shelves: ShelfRepository) =>
            new LocationNaming(bookcases, shelves),
    },
    {
        provide: token.overview,
        inject: [token.bookcases, token.shelves, token.store],
        useFactory: (
            bookcases: BookcaseRepository,
            shelves: ShelfRepository,
            store: BookShelfStore,
        ) => new LocationOverview(bookcases, shelves, store, new LocationViewer()),
    },
];
const useCaseProviders: Provider[] = [
    {
        provide: 'LOCATIONS_LIST',
        inject: [token.overview],
        useFactory: (overview: LocationOverview) => new ListBookcases(overview),
    },
    {
        provide: 'LOCATIONS_CREATE_BOOKCASE',
        inject: [
            token.bookcases,
            token.naming,
            token.overview,
            token.ids,
            token.clock,
            token.operations,
        ],
        useFactory: (
            bookcases: BookcaseRepository,
            naming: LocationNaming,
            overview: LocationOverview,
            ids: IdGenerator,
            clock: Clock,
            operations: AuditedOperation,
        ) => new CreateBookcase(bookcases, naming, overview, ids, clock, operations),
    },
    {
        provide: 'LOCATIONS_RENAME_BOOKCASE',
        inject: [
            token.bookcases,
            token.loader,
            token.naming,
            token.overview,
            token.clock,
            token.operations,
        ],
        useFactory: (
            bookcases: BookcaseRepository,
            loader: LocationLoader,
            naming: LocationNaming,
            overview: LocationOverview,
            clock: Clock,
            operations: AuditedOperation,
        ) => new RenameBookcase(bookcases, loader, naming, overview, clock, operations),
    },
    {
        provide: 'LOCATIONS_DELETE_BOOKCASE',
        inject: [token.bookcases, token.loader, token.overview, token.operations],
        useFactory: (
            bookcases: BookcaseRepository,
            loader: LocationLoader,
            overview: LocationOverview,
            operations: AuditedOperation,
        ) => new DeleteBookcase(bookcases, loader, overview, operations),
    },
    {
        provide: 'LOCATIONS_CREATE_SHELF',
        inject: [
            token.shelves,
            token.loader,
            token.naming,
            token.overview,
            token.ids,
            token.clock,
            token.operations,
        ],
        useFactory: (
            shelves: ShelfRepository,
            loader: LocationLoader,
            naming: LocationNaming,
            overview: LocationOverview,
            ids: IdGenerator,
            clock: Clock,
            operations: AuditedOperation,
        ) => new CreateShelf(shelves, loader, naming, overview, ids, clock, operations),
    },
    {
        provide: 'LOCATIONS_CHANGE_SHELF',
        inject: [
            token.shelves,
            token.loader,
            token.naming,
            token.overview,
            token.clock,
            token.operations,
        ],
        useFactory: (
            shelves: ShelfRepository,
            loader: LocationLoader,
            naming: LocationNaming,
            overview: LocationOverview,
            clock: Clock,
            operations: AuditedOperation,
        ) => new ChangeShelf(shelves, loader, naming, overview, clock, operations),
    },
    {
        provide: 'LOCATIONS_DELETE_SHELF',
        inject: [token.shelves, token.loader, token.overview, token.operations],
        useFactory: (
            shelves: ShelfRepository,
            loader: LocationLoader,
            overview: LocationOverview,
            operations: AuditedOperation,
        ) => new DeleteShelf(shelves, loader, overview, operations),
    },
];

@Module({})
export class LocationsModule {
    static register(dependencies: LocationsDependencies): DynamicModule {
        return {
            module: LocationsModule,
            controllers: [BookcasesController, ShelvesController],
            providers: [
                ...ValueProviders.of(dependencies, token),
                ...serviceProviders,
                ...useCaseProviders,
            ],
        };
    }

    static assignment(
        bookcases: BookcaseRepository,
        shelves: ShelfRepository,
        store: BookShelfStore,
    ): ShelfAssignment & BookLocationReader & ShelfLocator {
        return new BookShelfAssignment(store, new LocationLoader(bookcases, shelves));
    }
}
