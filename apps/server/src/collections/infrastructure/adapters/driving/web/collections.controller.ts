import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Inject,
    Param,
    Patch,
    Post,
    Query,
    Req,
} from '@nestjs/common';
import type { z } from 'zod';
import type { DeleteCollectionUseCase } from '../../../../application/ports/driving/delete-collection-use-case.interface.js';
import type { FindCollectionsUseCase } from '../../../../application/ports/driving/find-collections-use-case.interface.js';
import type { FinishCollectionUseCase } from '../../../../application/ports/driving/finish-collection-use-case.interface.js';
import type { GetCollectionUseCase } from '../../../../application/ports/driving/get-collection-use-case.interface.js';
import type { GetCollectionShoppingUseCase } from '../../../../application/ports/driving/get-collection-shopping-use-case.interface.js';
import type { ListCollectionsUseCase } from '../../../../application/ports/driving/list-collections-use-case.interface.js';
import type { ListShoppingCollectionsUseCase } from '../../../../application/ports/driving/list-shopping-collections-use-case.interface.js';
import type { ReopenCollectionUseCase } from '../../../../application/ports/driving/reopen-collection-use-case.interface.js';
import type { UpdateCollectionUseCase } from '../../../../application/ports/driving/update-collection-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import { BookFilterQueryMapper } from '../../../../../shared/infrastructure/adapters/driving/web/book-filter-query.mapper.js';
import type {
    CollectionDetailsDto,
    CollectionListPageDto,
    CollectionNameDto,
    CollectionShoppingDto,
    ShoppingCollectionDto,
} from '../../../../../../../../packages/contracts/src/http.js';
import {
    collectionChangesSchema,
    collectionIdSchema,
    collectionListSchema,
    collectionNamesSchema,
} from './collection-schemas.js';

@Controller('api/collections')
export class CollectionsController {
    constructor(
        @Inject('COLLECTIONS_LIST') private readonly listCollections: ListCollectionsUseCase,
        @Inject('COLLECTIONS_FIND') private readonly findCollections: FindCollectionsUseCase,
        @Inject('COLLECTIONS_GET') private readonly getCollection: GetCollectionUseCase,
        @Inject('COLLECTIONS_UPDATE') private readonly updateCollection: UpdateCollectionUseCase,
        @Inject('COLLECTIONS_FINISH') private readonly finishCollection: FinishCollectionUseCase,
        @Inject('COLLECTIONS_REOPEN') private readonly reopenCollection: ReopenCollectionUseCase,
        @Inject('COLLECTIONS_DELETE') private readonly deleteCollection: DeleteCollectionUseCase,
        @Inject('COLLECTIONS_SHOPPING_LIST')
        private readonly listShopping: ListShoppingCollectionsUseCase,
        @Inject('COLLECTIONS_SHOPPING_GET')
        private readonly getShopping: GetCollectionShoppingUseCase,
    ) {}

    @Get()
    list(
        @Query({ schema: collectionListSchema }) query: z.infer<typeof collectionListSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<CollectionListPageDto> {
        const { search, direction, offset, limit } = query;

        return this.listCollections.execute(request.actor, {
            search,
            direction,
            offset,
            limit,
            filter: BookFilterQueryMapper.toFilter(query),
        });
    }

    // Declared before `:id` so that `names` is not read as an identifier.
    @Get('names')
    names(
        @Query({ schema: collectionNamesSchema }) query: z.infer<typeof collectionNamesSchema>,
    ): Promise<CollectionNameDto[]> {
        return this.findCollections.execute(query.search);
    }

    // Declared before `:id` so that `shopping` is not read as an identifier.
    @Get('shopping')
    shoppingList(@Req() request: AuthenticatedRequest): Promise<ShoppingCollectionDto[]> {
        return this.listShopping.execute(request.actor);
    }

    @Get(':id/shopping')
    shopping(
        @Param('id', { schema: collectionIdSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<CollectionShoppingDto> {
        return this.getShopping.execute(request.actor, id);
    }

    @Get(':id')
    get(@Param('id', { schema: collectionIdSchema }) id: string): Promise<CollectionDetailsDto> {
        return this.getCollection.execute(id);
    }

    @Patch(':id')
    update(
        @Param('id', { schema: collectionIdSchema }) id: string,
        @Body({ schema: collectionChangesSchema }) changes: z.infer<typeof collectionChangesSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<CollectionDetailsDto> {
        return this.updateCollection.execute(request.actor, id, changes);
    }

    @Post(':id/finish')
    @HttpCode(200)
    finish(
        @Param('id', { schema: collectionIdSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<CollectionDetailsDto> {
        return this.finishCollection.execute(request.actor, id);
    }

    @Post(':id/reopen')
    @HttpCode(200)
    reopen(
        @Param('id', { schema: collectionIdSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<CollectionDetailsDto> {
        return this.reopenCollection.execute(request.actor, id);
    }

    @Delete(':id')
    @HttpCode(204)
    async delete(
        @Param('id', { schema: collectionIdSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<void> {
        await this.deleteCollection.execute(request.actor, id);
    }
}
