import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { Note } from '../../../domain/entities/note.entity.js';

export interface UpdateNoteUseCase {
    execute(actor: Actor, id: string, input: { title: string; body: string }): Promise<Note>;
}
