import type { CreateNoteUseCase } from '../ports/driving/create-note-use-case.interface.js';
import { Note } from '../../domain/entities/note.entity.js';
import type { NoteWriter } from '../ports/driven/note-writer.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';

export class CreateNote implements CreateNoteUseCase {
    constructor(
        private readonly notes: NoteWriter,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(actor: Actor, input: { title: string; body: string }): Promise<Note> {
        ActorAuthorization.requireReady(actor);
        const now = this.clock.now().toISOString();
        const note = new Note({
            ...input,
            id: this.ids.next(),
            ownerId: actor.id,
            createdAt: now,
            updatedAt: now,
        });

        await this.notes.create(note);

        return note;
    }
}
