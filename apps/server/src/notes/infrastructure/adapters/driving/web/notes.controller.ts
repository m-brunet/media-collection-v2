import {
    Inject,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Req,
} from '@nestjs/common';
import { z } from 'zod';
import type { CreateNoteUseCase } from '../../../../application/ports/driving/create-note-use-case.interface.js';
import type { DeleteNoteUseCase } from '../../../../application/ports/driving/delete-note-use-case.interface.js';
import type { GetNoteUseCase } from '../../../../application/ports/driving/get-note-use-case.interface.js';
import type { ListNotesUseCase } from '../../../../application/ports/driving/list-notes-use-case.interface.js';
import type { UpdateNoteUseCase } from '../../../../application/ports/driving/update-note-use-case.interface.js';
import type { Note } from '../../../../domain/entities/note.entity.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { NoteDto } from '../../../../../../../../packages/contracts/src/http.js';

const inputSchema = z.strictObject({
    title: z.string().min(1).max(120),
    body: z.string().max(100_000),
});
const idSchema = z.string().uuid();

@Controller('api/notes')
export class NotesController {
    constructor(
        @Inject('NOTES_LIST_NOTES') private readonly list: ListNotesUseCase,
        @Inject('NOTES_GET_NOTE') private readonly get: GetNoteUseCase,
        @Inject('NOTES_CREATE_NOTE') private readonly create: CreateNoteUseCase,
        @Inject('NOTES_UPDATE_NOTE') private readonly update: UpdateNoteUseCase,
        @Inject('NOTES_DELETE_NOTE') private readonly remove: DeleteNoteUseCase,
    ) {}

    @Get()
    async all(@Req() request: AuthenticatedRequest) {
        return (await this.list.execute(request.actor)).map((value) => this.dto(value));
    }

    @Get(':id')
    async one(@Param('id', { schema: idSchema }) id: string, @Req() request: AuthenticatedRequest) {
        return this.dto(await this.get.execute(request.actor, id));
    }

    @Post()
    async add(
        @Body({ schema: inputSchema }) input: z.infer<typeof inputSchema>,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.dto(await this.create.execute(request.actor, input));
    }

    @Patch(':id')
    async edit(
        @Param('id', { schema: idSchema }) id: string,
        @Body({ schema: inputSchema }) input: z.infer<typeof inputSchema>,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.dto(await this.update.execute(request.actor, id, input));
    }

    @Delete(':id')
    @HttpCode(204)
    async delete(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ) {
        await this.remove.execute(request.actor, id);
    }

    private dto(note: Note): NoteDto {
        const { id, title, body, createdAt, updatedAt } = note.snapshot;

        return { id, title, body, createdAt, updatedAt };
    }
}
