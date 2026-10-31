import type { UpdateNoteUseCase } from '../ports/driving/update-note-use-case.interface.js';
import { Note } from '../../domain/entities/note.entity.js';
import type { NoteRepository } from '../ports/driven/note-repository.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';

export class UpdateNote implements UpdateNoteUseCase {
    constructor(
        private readonly notes: NoteRepository,
        private readonly clock: Clock,
    ) {}

    async execute(actor: Actor, id: string, input: { title: string; body: string }): Promise<Note> {
        ActorAuthorization.requireReady(actor);
        const note = await this.notes.find(actor.id, id);

        if (!note) {
            throw new Failure('not_found', 'Note not found.');
        }

        note.edit(input.title, input.body, this.clock.now().toISOString());

        if (!(await this.notes.save(note))) {
            throw new Failure('not_found', 'Note not found.');
        }

        return note;
    }
}
