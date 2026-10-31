import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ListUsersUseCase {
    execute(actor: Actor): Promise<Actor[]>;
}
