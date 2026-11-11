import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ShelfChanges, ShelfView } from '../../location-views.js';

export interface ChangeShelfUseCase {
    execute(actor: Actor, shelfId: string, changes: ShelfChanges): Promise<ShelfView>;
}
