import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { Note } from '../../../domain/entities/note.entity.js';

export interface CreateNoteUseCase {
    execute(actor: Actor, input: { title: string; body: string }): Promise<Note>;
}
