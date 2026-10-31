import type { DeleteNoteUseCase } from '../ports/driving/delete-note-use-case.interface.js';
import type { NoteWriter } from '../ports/driven/note-writer.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class DeleteNote implements DeleteNoteUseCase {
    constructor(private readonly notes: NoteWriter) {}

    async execute(actor: Actor, id: string): Promise<void> {
        ActorAuthorization.requireReady(actor);

        if (!(await this.notes.delete(actor.id, id))) {
            throw new Failure('not_found', 'Note not found.');
        }
    }
}
