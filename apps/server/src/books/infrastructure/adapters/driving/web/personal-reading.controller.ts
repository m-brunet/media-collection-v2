import { Body, Controller, Delete, HttpCode, Inject, Param, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import type { DeletePersonalNoteUseCase } from '../../../../application/ports/driving/delete-personal-note-use-case.interface.js';
import type { SavePersonalNoteUseCase } from '../../../../application/ports/driving/save-personal-note-use-case.interface.js';
import type { SetReadingStatusUseCase } from '../../../../application/ports/driving/set-reading-status-use-case.interface.js';
import type { AuthenticatedRequest } from '../../../../../shared/infrastructure/adapters/driving/web/api-guard.js';
import type { PersonalNoteDto } from '../../../../../../../../packages/contracts/src/http.js';
import { idSchema } from './book-schemas.js';

const readingSchema = z.strictObject({ read: z.boolean() });
const noteSchema = z.strictObject({ text: z.string().max(20000) });

@Controller('api/books/:id')
export class PersonalReadingController {
    constructor(
        @Inject('BOOKS_SET_READING_STATUS')
        private readonly setReadingStatus: SetReadingStatusUseCase,
        @Inject('BOOKS_SAVE_NOTE') private readonly saveNote: SavePersonalNoteUseCase,
        @Inject('BOOKS_DELETE_NOTE') private readonly deleteNote: DeletePersonalNoteUseCase,
    ) {}

    @Put('reading')
    reading(
        @Param('id', { schema: idSchema }) id: string,
        @Body({ schema: readingSchema }) input: z.infer<typeof readingSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<{ read: boolean }> {
        return this.setReadingStatus.execute(request.actor, id, input.read);
    }

    @Put('note')
    note(
        @Param('id', { schema: idSchema }) id: string,
        @Body({ schema: noteSchema }) input: z.infer<typeof noteSchema>,
        @Req() request: AuthenticatedRequest,
    ): Promise<PersonalNoteDto> {
        return this.saveNote.execute(request.actor, id, input.text);
    }

    @Delete('note')
    @HttpCode(204)
    async removeNote(
        @Param('id', { schema: idSchema }) id: string,
        @Req() request: AuthenticatedRequest,
    ): Promise<void> {
        await this.deleteNote.execute(request.actor, id);
    }
}
