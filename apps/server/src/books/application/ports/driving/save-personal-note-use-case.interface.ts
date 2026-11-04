import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SavePersonalNoteUseCase {
    // Creates or replaces the signed-in account's own private note on a book.
    execute(
        actor: Actor,
        bookId: string,
        text: string,
    ): Promise<{ text: string; updatedAt: string }>;
}
