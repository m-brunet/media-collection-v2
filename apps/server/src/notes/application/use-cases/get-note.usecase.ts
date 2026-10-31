import type { GetNoteUseCase } from '../ports/driving/get-note-use-case.interface.js';
import { Note } from '../../domain/entities/note.entity.js';
import type { NoteReader } from '../ports/driven/note-reader.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class GetNote implements GetNoteUseCase {
    constructor(private readonly notes: NoteReader) {}

    async execute(actor: Actor, id: string): Promise<Note> {
        ActorAuthorization.requireReady(actor);
        const note = await this.notes.find(actor.id, id);

        if (!note) {
            throw new Failure('not_found', 'Note not found.');
        }

        return note;
    }
}
