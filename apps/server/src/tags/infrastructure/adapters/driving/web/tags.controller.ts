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
import type { CreateTagUseCase } from '../../../../application/ports/driving/create-tag-use-case.interface.js';
import type { DeleteTagUseCase } from '../../../../application/ports/driving/delete-tag-use-case.interface.js';
import type { ListTagsUseCase } from '../../../../application/ports/driving/list-tags-use-case.interface.js';
import type { RenameTagUseCase } from '../../../../application/ports/driving/rename-tag-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { TagDto } from '../../../../../../../../packages/contracts/src/http.js';
import { tagIdSchema, tagNameSchema, tagSearchSchema } from './tag-schemas.js';

@Controller('api/tags')
export class TagsController {
    constructor(
        @Inject('TAGS_LIST') private readonly listTags: ListTagsUseCase,
        @Inject('TAGS_CREATE') private readonly createTag: CreateTagUseCase,
        @Inject('TAGS_RENAME') private readonly renameTag: RenameTagUseCase,
        @Inject('TAGS_DELETE') private readonly deleteTag: DeleteTagUseCase,
    ) {}

    @Get()
    list(
        @Query({ schema: tagSearchSchema }) query: z.infer<typeof tagSearchSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<TagDto[]> {
        return this.listTags.execute(request.actor, query.search);
    }

    @Post()
    create(
        @Body({ schema: tagNameSchema }) body: z.infer<typeof tagNameSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<TagDto> {
        return this.createTag.execute(request.actor, body.name);
    }

    @Patch(':id')
    rename(
        @Param('id', { schema: tagIdSchema }) id: string,
        @Body({ schema: tagNameSchema }) body: z.infer<typeof tagNameSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<TagDto> {
        return this.renameTag.execute(request.actor, id, body.name);
    }

    @Delete(':id')
    @HttpCode(204)
    async delete(
        @Param('id', { schema: tagIdSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<void> {
        await this.deleteTag.execute(request.actor, id);
    }
}
