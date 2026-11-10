import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SavePersonalNoteUseCase {
    execute(
        actor: Actor,
        bookId: string,
        text: string,
    ): Promise<{ text: string; updatedAt: string }>;
}
