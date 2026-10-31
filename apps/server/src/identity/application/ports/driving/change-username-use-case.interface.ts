import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ChangeUsernameUseCase {
    execute(actor: Actor, username: string, currentPassword: string): Promise<Actor>;
}
