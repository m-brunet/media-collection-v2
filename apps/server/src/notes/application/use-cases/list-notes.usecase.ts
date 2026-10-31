import type { ListNotesUseCase } from '../ports/driving/list-notes-use-case.interface.js';
import { Note } from '../../domain/entities/note.entity.js';
import type { NoteReader } from '../ports/driven/note-reader.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ListNotes implements ListNotesUseCase {
    constructor(private readonly notes: NoteReader) {}

    async execute(actor: Actor): Promise<Note[]> {
        ActorAuthorization.requireReady(actor);

        return this.notes.list(actor.id);
    }
}
