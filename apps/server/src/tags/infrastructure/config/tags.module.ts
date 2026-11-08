import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ValueProviders } from '../../../shared/infrastructure/config/value-providers.helper.js';
import type { BookTagReader } from '../../../books/application/ports/driven/book-tag-reader.interface.js';
import type { TagAssignment } from '../../../books/application/ports/driven/tag-assignment.interface.js';
import type { BookTagStore } from '../../application/ports/driven/book-tag-store.interface.js';
import type { TagRepository } from '../../application/ports/driven/tag-repository.interface.js';
import { BookTagAssignment } from '../../application/services/book-tag-assignment.service.js';
import { TagLoader } from '../../application/services/tag-loader.service.js';
import { TagNaming } from '../../application/services/tag-naming.service.js';
import { TagViewer } from '../../application/services/tag-viewer.service.js';
import { CreateTag } from '../../application/use-cases/create-tag.usecase.js';
import { DeleteTag } from '../../application/use-cases/delete-tag.usecase.js';
import { ListTags } from '../../application/use-cases/list-tags.usecase.js';
import { RenameTag } from '../../application/use-cases/rename-tag.usecase.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { TagsController } from '../adapters/driving/web/tags.controller.js';

// Driven adapters and shared services the tags feature is composed from.
export interface TagsDependencies {
    tags: TagRepository;
    store: BookTagStore;
    ids: IdGenerator;
    clock: Clock;
    operations: AuditedOperation;
}

const token = {
    tags: 'TAGS_REPOSITORY',
    store: 'TAGS_BOOK_TAGS',
    ids: 'TAGS_IDS',
    clock: 'TAGS_CLOCK',
    operations: 'TAGS_AUDITED_OPERATION',
    loader: 'TAGS_LOADER',
    naming: 'TAGS_NAMING',
    viewer: 'TAGS_VIEWER',
} as const;
const serviceProviders: Provider[] = [
    {
        provide: token.loader,
        inject: [token.tags],
        useFactory: (tags: TagRepository) => new TagLoader(tags),
    },
    {
        provide: token.naming,
        inject: [token.tags],
        useFactory: (tags: TagRepository) => new TagNaming(tags),
    },
    { provide: token.viewer, useFactory: () => new TagViewer() },
];
const useCaseProviders: Provider[] = [
    {
        provide: 'TAGS_LIST',
        inject: [token.tags, token.store, token.viewer],
        useFactory: (tags: TagRepository, store: BookTagStore, viewer: TagViewer) =>
            new ListTags(tags, store, viewer),
    },
    {
        provide: 'TAGS_CREATE',
        inject: [token.tags, token.naming, token.viewer, token.ids, token.clock, token.operations],
        useFactory: (
            tags: TagRepository,
            naming: TagNaming,
            viewer: TagViewer,
            ids: IdGenerator,
            clock: Clock,
            operations: AuditedOperation,
        ) => new CreateTag(tags, naming, viewer, ids, clock, operations),
    },
    {
        provide: 'TAGS_RENAME',
        inject: [
            token.tags,
            token.store,
            token.loader,
            token.naming,
            token.viewer,
            token.clock,
            token.operations,
        ],
        useFactory: (
            tags: TagRepository,
            store: BookTagStore,
            loader: TagLoader,
            naming: TagNaming,
            viewer: TagViewer,
            clock: Clock,
            operations: AuditedOperation,
        ) => new RenameTag(tags, store, loader, naming, viewer, clock, operations),
    },
    {
        provide: 'TAGS_DELETE',
        inject: [token.tags, token.store, token.loader, token.operations],
        useFactory: (
            tags: TagRepository,
            store: BookTagStore,
            loader: TagLoader,
            operations: AuditedOperation,
        ) => new DeleteTag(tags, store, loader, operations),
    },
];

@Module({})
export class TagsModule {
    static register(dependencies: TagsDependencies): DynamicModule {
        return {
            module: TagsModule,
            controllers: [TagsController],
            providers: [
                ...ValueProviders.of(dependencies, token),
                ...serviceProviders,
                ...useCaseProviders,
            ],
        };
    }

    // The tags the books feature applies when books are saved, and reads with them.
    static assignment(
        tags: TagRepository,
        store: BookTagStore,
        ids: IdGenerator,
        clock: Clock,
    ): TagAssignment & BookTagReader {
        return new BookTagAssignment(tags, store, new TagLoader(tags), ids, clock);
    }
}
