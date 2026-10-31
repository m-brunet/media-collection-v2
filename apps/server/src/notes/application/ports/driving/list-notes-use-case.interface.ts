import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { Note } from '../../../domain/entities/note.entity.js';

export interface ListNotesUseCase {
    execute(actor: Actor): Promise<Note[]>;
}
