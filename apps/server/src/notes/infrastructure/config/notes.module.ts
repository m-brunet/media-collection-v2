import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { NoteRepository } from '../../application/ports/driven/note-repository.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import { CreateNote } from '../../application/use-cases/create-note.usecase.js';
import { DeleteNote } from '../../application/use-cases/delete-note.usecase.js';
import { GetNote } from '../../application/use-cases/get-note.usecase.js';
import { ListNotes } from '../../application/use-cases/list-notes.usecase.js';
import { UpdateNote } from '../../application/use-cases/update-note.usecase.js';
import { NotesController } from '../adapters/driving/web/notes.controller.js';

export const NOTES_NOTE_REPOSITORY = 'NOTES_NOTE_REPOSITORY';
export const NOTES_ID_GENERATOR = 'NOTES_ID_GENERATOR';
export const NOTES_CLOCK = 'NOTES_CLOCK';
export const NOTES_LIST_NOTES = 'NOTES_LIST_NOTES';
export const NOTES_GET_NOTE = 'NOTES_GET_NOTE';
export const NOTES_CREATE_NOTE = 'NOTES_CREATE_NOTE';
export const NOTES_UPDATE_NOTE = 'NOTES_UPDATE_NOTE';
export const NOTES_DELETE_NOTE = 'NOTES_DELETE_NOTE';

@Module({})
export class NotesModule {
    static register(notes: NoteRepository, ids: IdGenerator, clock: Clock): DynamicModule {
        return {
            module: NotesModule,
            controllers: [NotesController],
            providers: [
                { provide: NOTES_NOTE_REPOSITORY, useValue: notes },
                { provide: NOTES_ID_GENERATOR, useValue: ids },
                { provide: NOTES_CLOCK, useValue: clock },
                {
                    provide: NOTES_LIST_NOTES,
                    inject: [NOTES_NOTE_REPOSITORY],
                    useFactory: (notes: NoteRepository) => new ListNotes(notes),
                },
                {
                    provide: NOTES_GET_NOTE,
                    inject: [NOTES_NOTE_REPOSITORY],
                    useFactory: (notes: NoteRepository) => new GetNote(notes),
                },
                {
                    provide: NOTES_CREATE_NOTE,
                    inject: [NOTES_NOTE_REPOSITORY, NOTES_ID_GENERATOR, NOTES_CLOCK],
                    useFactory: (notes: NoteRepository, ids: IdGenerator, clock: Clock) =>
                        new CreateNote(notes, ids, clock),
                },
                {
                    provide: NOTES_UPDATE_NOTE,
                    inject: [NOTES_NOTE_REPOSITORY, NOTES_CLOCK],
                    useFactory: (notes: NoteRepository, clock: Clock) =>
                        new UpdateNote(notes, clock),
                },
                {
                    provide: NOTES_DELETE_NOTE,
                    inject: [NOTES_NOTE_REPOSITORY],
                    useFactory: (notes: NoteRepository) => new DeleteNote(notes),
                },
            ],
        };
    }
}
