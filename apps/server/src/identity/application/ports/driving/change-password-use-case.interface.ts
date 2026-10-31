import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ChangePasswordUseCase {
    execute(actor: Actor, currentPassword: string, password: string): Promise<Actor>;
}
