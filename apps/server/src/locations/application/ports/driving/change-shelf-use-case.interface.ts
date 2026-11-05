import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ShelfChanges, ShelfView } from '../../location-views.js';

export interface ChangeShelfUseCase {
    // Renames the shelf and/or moves it, with its books, to another bookcase.
    execute(actor: Actor, shelfId: string, changes: ShelfChanges): Promise<ShelfView>;
}
