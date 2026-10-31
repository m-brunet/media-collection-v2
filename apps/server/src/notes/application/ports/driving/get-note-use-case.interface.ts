import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { Note } from '../../../domain/entities/note.entity.js';

export interface GetNoteUseCase {
    execute(actor: Actor, id: string): Promise<Note>;
}
