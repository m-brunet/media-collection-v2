import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { BookCollectionReader } from '../../../books/application/ports/driven/book-collection-reader.interface.js';
import type { CollectionMembership } from '../../../books/application/ports/driven/collection-membership.interface.js';
import type { CollectionBookSearch } from '../../application/ports/driven/collection-book-search.interface.js';
import type { CollectionMemberStore } from '../../application/ports/driven/collection-member-store.interface.js';
import type { CollectionRepository } from '../../application/ports/driven/collection-repository.interface.js';
import { BookCollectionMembership } from '../../application/services/book-collection-membership.service.js';
import { CollectionLoader } from '../../application/services/collection-loader.service.js';
import { CollectionUpkeep } from '../../application/services/collection-upkeep.service.js';
import { CollectionViewer } from '../../application/services/collection-viewer.service.js';
import { DeleteCollection } from '../../application/use-cases/delete-collection.usecase.js';
import { FindCollections } from '../../application/use-cases/find-collections.usecase.js';
import { FinishCollection } from '../../application/use-cases/finish-collection.usecase.js';
import { GetCollection } from '../../application/use-cases/get-collection.usecase.js';
import { ListCollections } from '../../application/use-cases/list-collections.usecase.js';
import { ReopenCollection } from '../../application/use-cases/reopen-collection.usecase.js';
import { UpdateCollection } from '../../application/use-cases/update-collection.usecase.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { CollectionsController } from '../adapters/driving/web/collections.controller.js';

// Driven adapters and shared services the collections feature is composed from.
export interface CollectionsDependencies {
    collections: CollectionRepository;
    members: CollectionMemberStore;
    search: CollectionBookSearch;
    clock: Clock;
    operations: AuditedOperation;
}

const token = {
    collections: 'COLLECTIONS_REPOSITORY',
    members: 'COLLECTIONS_MEMBERS',
    search: 'COLLECTIONS_BOOK_SEARCH',
    clock: 'COLLECTIONS_CLOCK',
    operations: 'COLLECTIONS_AUDITED_OPERATION',
    loader: 'COLLECTIONS_LOADER',
    viewer: 'COLLECTIONS_VIEWER',
} as const;

function dependencyProviders(dependencies: CollectionsDependencies): Provider[] {
    return (Object.keys(dependencies) as (keyof CollectionsDependencies)[]).map((name) => ({
        provide: token[name],
        useValue: dependencies[name],
    }));
}

const serviceProviders: Provider[] = [
    {
        provide: token.loader,
        inject: [token.collections],
        useFactory: (collections: CollectionRepository) => new CollectionLoader(collections),
    },
    { provide: token.viewer, useFactory: () => new CollectionViewer() },
];
// Use cases that change a collection share the same collaborators.
const changeDependencies = [
    token.collections,
    token.members,
    token.loader,
    token.viewer,
    token.clock,
    token.operations,
];

type ChangeUseCase = new (
    collections: CollectionRepository,
    members: CollectionMemberStore,
    loader: CollectionLoader,
    viewer: CollectionViewer,
    clock: Clock,
    operations: AuditedOperation,
) => unknown;

function changeProvider(provide: string, useCase: ChangeUseCase): Provider {
    return {
        provide,
        inject: changeDependencies,
        useFactory: (
            collections: CollectionRepository,
            members: CollectionMemberStore,
            loader: CollectionLoader,
            viewer: CollectionViewer,
            clock: Clock,
            operations: AuditedOperation,
        ) => new useCase(collections, members, loader, viewer, clock, operations),
    };
}

const useCaseProviders: Provider[] = [
    {
        provide: 'COLLECTIONS_LIST',
        inject: [token.collections, token.members, token.search, token.viewer],
        useFactory: (
            collections: CollectionRepository,
            members: CollectionMemberStore,
            search: CollectionBookSearch,
            viewer: CollectionViewer,
        ) => new ListCollections(collections, members, search, viewer),
    },
    {
        provide: 'COLLECTIONS_FIND',
        inject: [token.collections],
        useFactory: (collections: CollectionRepository) => new FindCollections(collections),
    },
    {
        provide: 'COLLECTIONS_GET',
        inject: [token.loader, token.members, token.viewer],
        useFactory: (
            loader: CollectionLoader,
            members: CollectionMemberStore,
            viewer: CollectionViewer,
        ) => new GetCollection(loader, members, viewer),
    },
    changeProvider('COLLECTIONS_UPDATE', UpdateCollection),
    changeProvider('COLLECTIONS_FINISH', FinishCollection),
    changeProvider('COLLECTIONS_REOPEN', ReopenCollection),
    {
        provide: 'COLLECTIONS_DELETE',
        inject: [token.collections, token.members, token.loader, token.operations],
        useFactory: (
            collections: CollectionRepository,
            members: CollectionMemberStore,
            loader: CollectionLoader,
            operations: AuditedOperation,
        ) => new DeleteCollection(collections, members, loader, operations),
    },
];

@Module({})
export class CollectionsModule {
    static register(dependencies: CollectionsDependencies): DynamicModule {
        return {
            module: CollectionsModule,
            controllers: [CollectionsController],
            providers: [
                ...dependencyProviders(dependencies),
                ...serviceProviders,
                ...useCaseProviders,
            ],
        };
    }

    // The membership the books feature applies when books are saved or deleted, and reads with them.
    static membership(
        collections: CollectionRepository,
        members: CollectionMemberStore,
        ids: IdGenerator,
        clock: Clock,
    ): CollectionMembership & BookCollectionReader {
        return new BookCollectionMembership(
            collections,
            members,
            new CollectionLoader(collections),
            new CollectionUpkeep(collections, members),
            ids,
            clock,
        );
    }
}
