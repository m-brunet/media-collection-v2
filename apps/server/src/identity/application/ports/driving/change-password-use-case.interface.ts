import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ChangePasswordUseCase {
    execute(actor: Actor, currentPassword: string | null, password: string): Promise<Actor>;
}
