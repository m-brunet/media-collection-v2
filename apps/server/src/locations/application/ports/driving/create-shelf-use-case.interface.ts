import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ShelfView } from '../../location-views.js';

export interface CreateShelfUseCase {
    execute(actor: Actor, bookcaseId: string, name: string): Promise<ShelfView>;
}
